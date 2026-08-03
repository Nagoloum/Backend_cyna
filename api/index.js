// Augmente le pool de threads libuv AVANT tout I/O : les resolutions DNS
// (getaddrinfo) de mongo + Sentry + Stripe + Cloudinary au demarrage saturent
// le pool par defaut (4 threads), ce qui bloquait la connexion mongo en
// readyState=2 sur Vercel. Doit etre defini avant le 1er usage du pool.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '64';

// Point d'entrée serverless pour Vercel.
//
// On importe l'application NestJS DÉJÀ COMPILÉE (`dist/main.js`) plutôt que les
// sources TypeScript : la compilation est faite en amont par `npm run build`
// (buildCommand dans vercel.json), ce qui garantit que les métadonnées des
// décorateurs (DI NestJS) sont bien émises.
//
// L'app est bootstrappée UNE SEULE FOIS puis mise en cache entre les
// invocations, pour réutiliser la connexion MongoDB (important en serverless).

// Capture console + kick (diagnostic temporaire).
if (!globalThis.__cap) {
  globalThis.__cap = true;
  globalThis.__logs = [];
  const cap = (orig) => (...a) => {
    try {
      globalThis.__logs.push(a.map((x) => (typeof x === 'string' ? x : (x && x.message) || '')).join(' ').slice(0, 300));
      if (globalThis.__logs.length > 100) globalThis.__logs.shift();
    } catch (_) {}
    return orig(...a);
  };
  console.log = cap(console.log.bind(console));
  console.error = cap(console.error.bind(console));
}

const express = require('express');
const { createNestApp } = require('../dist/main');

const server = express();
let bootstrapPromise = null;

// Origines autorisées (miroir de main.ts allowedOrigins).
const ALLOWED_ORIGINS = new Set([
  'https://cynaapp.vercel.app',
  'http://localhost:5173',
  'http://localhost',
  ...(process.env.FRONTEND_URL || '').split(',').map((o) => o.trim()).filter(Boolean),
]);

async function bootstrap() {
  const app = await createNestApp(server);
  await app.init();
  return app;
}

module.exports = async (req, res) => {
  const origin = req.headers['origin'];

  // Positionne les en-têtes CORS dès l'entrée dans la fonction serverless,
  // avant que Vercel ou NestJS ne puisse les écraser / vider.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  // Probe connexion (temporaire). __probe = mongoose.connect (defaut) ;
  // __probe2 = mongoose.createConnection (methode exacte de @nestjs/mongoose).
  if (req.url && req.url.includes('__probe2')) {
    res.setHeader('Content-Type', 'application/json');
    const start = Date.now();
    try {
      const mongoose = require('mongoose');
      const conn = mongoose.createConnection(process.env.DATABASE_URL || '', {
        serverSelectionTimeoutMS: 8000,
      });
      await Promise.race([
        conn.asPromise(),
        new Promise((_, r) => setTimeout(() => r(new Error('CREATECONN_TIMEOUT_15s')), 15000)),
      ]);
      const users = await conn.db.collection('users').countDocuments();
      await conn.close();
      return res.status(200).end(JSON.stringify({ ok: true, method: 'createConnection', ms: Date.now() - start, users }));
    } catch (e) {
      return res.status(200).end(JSON.stringify({ ok: false, method: 'createConnection', ms: Date.now() - start, error: e && e.message ? e.message : String(e) }));
    }
  }
  if (req.url && req.url.includes('__probe')) {
    res.setHeader('Content-Type', 'application/json');
    const start = Date.now();
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.DATABASE_URL || '', {
        serverSelectionTimeoutMS: 8000,
      });
      const users = await mongoose.connection.db.collection('users').countDocuments();
      await mongoose.disconnect();
      return res.status(200).end(JSON.stringify({ ok: true, method: 'connect', ms: Date.now() - start, users }));
    } catch (e) {
      return res.status(200).end(
        JSON.stringify({ ok: false, ms: Date.now() - start, error: e && e.message ? e.message : String(e) }),
      );
    }
  }

  if (req.url && req.url.includes('__logs')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).end(JSON.stringify({ logs: globalThis.__logs || [] }));
  }
  if (req.url && req.url.includes('__kick')) {
    res.setHeader('Content-Type', 'application/json');
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap().catch((e) => {
        console.error('[kick-reject] ' + (e && e.message ? e.message : String(e)));
        bootstrapPromise = null;
      });
    }
    // Retour IMMEDIAT avec les logs deja captures (kicker plusieurs fois pour
    // suivre la progression sur une instance chaude).
    const boot = (globalThis.__logs || []).filter(
      (l) => l.includes('boot') || l.includes('reject') || l.includes('rror'),
    );
    return res.status(200).end(JSON.stringify({ boot }));
  }

  // Court-circuit le preflight OPTIONS : répond immédiatement sans bootstrap.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type,Authorization,Cookie',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  if (!bootstrapPromise) {
    // IMPORTANT : ne pas mettre en cache une promesse de bootstrap ECHOUEE.
    // Sinon une panne transitoire au demarrage a froid fige l'instance en
    // erreur pour toutes les requetes suivantes. En cas d'echec on reinitialise
    // pour reessayer a la prochaine invocation.
    bootstrapPromise = bootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }

  try {
    await bootstrapPromise;
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error("[bootstrap] Echec du demarrage de l'application :", detail);
    res.setHeader('Content-Type', 'application/json');
    // On expose le message d'erreur de demarrage (typiquement une erreur de
    // connexion MongoDB) pour faciliter le diagnostic : "IP that isn't
    // whitelisted" => IP non autorisee dans l'allowlist Atlas ; "authentication
    // failed" => mauvais mot de passe dans DATABASE_URL ; ENOTFOUND => URL/DNS.
    return res.status(503).end(
      JSON.stringify({
        success: false,
        message: 'Service temporairement indisponible (connexion base de donnees).',
        detail,
      }),
    );
  }

  server(req, res);
};
