// Point d'entrée serverless pour Vercel.
//
// On importe l'application NestJS DÉJÀ COMPILÉE (`dist/main.js`) plutôt que les
// sources TypeScript : la compilation est faite en amont par `npm run build`
// (buildCommand dans vercel.json), ce qui garantit que les métadonnées des
// décorateurs (DI NestJS) sont bien émises.
//
// L'app est bootstrappée UNE SEULE FOIS puis mise en cache entre les
// invocations, pour réutiliser la connexion MongoDB (important en serverless).

// Capture des erreurs fatales non catchables (uncaughtException /
// unhandledRejection) AVANT tout le reste : sans handler, elles tuent le
// process (-> FUNCTION_INVOCATION_FAILED opaque). On les enregistre pour les
// exposer via /__fatal et diagnostiquer un crash de bootstrap.
if (!globalThis.__fatalHooked) {
  globalThis.__fatalHooked = true;
  globalThis.__fatal = null;
  globalThis.__logs = [];
  // Capture les sorties console en memoire (synchronement) pour pouvoir relire
  // les derniers points d'etape du bootstrap meme si l'event loop se bloque.
  const cap = (orig) => (...args) => {
    try {
      globalThis.__logs.push(
        args
          .map((a) => (typeof a === 'string' ? a : (a && a.message) || JSON.stringify(a)))
          .join(' ')
          .slice(0, 300),
      );
      if (globalThis.__logs.length > 200) globalThis.__logs.shift();
    } catch (_) {}
    return orig(...args);
  };
  // eslint-disable-next-line no-console
  console.log = cap(console.log.bind(console));
  // eslint-disable-next-line no-console
  console.error = cap(console.error.bind(console));
  const rec = (type) => (e) => {
    globalThis.__fatal = {
      type,
      msg: e && e.message ? e.message : String(e),
      stack: e && e.stack ? String(e.stack).split('\n').slice(0, 8) : null,
      at: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.error(`[FATAL ${type}]`, e && e.stack ? e.stack : e);
  };
  process.on('uncaughtException', rec('uncaughtException'));
  process.on('unhandledRejection', rec('unhandledRejection'));
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

  // ── Diagnostic connexion base de donnees (temporaire) ────────────────────
  // Teste une connexion Mongo DIRECTE (sans bootstrap Nest) et renvoie le
  // resultat/erreur en clair. Permet d'identifier la cause du 500 sans acceder
  // aux logs Vercel. A retirer une fois le probleme resolu.
  // Renvoie la derniere erreur fatale capturee (crash de bootstrap).
  if (req.url && req.url.includes('__fatal')) {
    res.setHeader('Content-Type', 'application/json');
    return res
      .status(200)
      .end(JSON.stringify({ fatal: globalThis.__fatal || null }));
  }

  // Renvoie les dernieres lignes de log capturees (points d'etape bootstrap).
  if (req.url && req.url.includes('__logs')) {
    res.setHeader('Content-Type', 'application/json');
    return res
      .status(200)
      .end(JSON.stringify({ logs: globalThis.__logs || [], fatal: globalThis.__fatal || null }));
  }

  // Force un (re)bootstrap en tache de fond puis renvoie l'etat immediatement,
  // sans attendre. Permet de declencher le bootstrap sur CETTE instance puis de
  // relire /__logs sur la meme instance chaude.
  if (req.url && req.url.includes('__kick')) {
    res.setHeader('Content-Type', 'application/json');
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap().catch((e) => {
        globalThis.__fatal = globalThis.__fatal || {
          type: 'bootstrap-reject',
          msg: e && e.message ? e.message : String(e),
          stack: e && e.stack ? String(e.stack).split('\n').slice(0, 8) : null,
        };
        bootstrapPromise = null;
      });
    }
    return res
      .status(200)
      .end(JSON.stringify({ kicked: true, logs: globalThis.__logs || [] }));
  }

  // Diagnostic : teste mongoose.connect (connexion PAR DEFAUT, exactement ce
  // qu'utilise MongooseModule) avec l'URL brute, comme le fait Nest sur Vercel.
  if (req.url && req.url.includes('__diagconnect')) {
    res.setHeader('Content-Type', 'application/json');
    const start = Date.now();
    const mask = (u) => (u || '').replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
    try {
      const mongoose = require('mongoose');
      const uri = process.env.DATABASE_URL || '';
      await Promise.race([
        mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }),
        new Promise((_, r) =>
          setTimeout(() => r(new Error('CONNECT_TIMEOUT_15s')), 15000),
        ),
      ]);
      const users = await mongoose.connection.db.collection('users').countDocuments();
      await mongoose.disconnect();
      return res.status(200).end(
        JSON.stringify({ ok: true, method: 'mongoose.connect', ms: Date.now() - start, users, uri: mask(uri) }),
      );
    } catch (e) {
      return res.status(200).end(
        JSON.stringify({ ok: false, method: 'mongoose.connect', ms: Date.now() - start, error: e && e.message ? e.message : String(e) }),
      );
    }
  }

  // Diagnostic bootstrap Nest complet (avec timeout) : pointe si le demarrage
  // pend et ou il echoue, independamment de la connexion Mongo directe.
  if (req.url && req.url.includes('__diagboot')) {
    res.setHeader('Content-Type', 'application/json');
    const start = Date.now();
    try {
      const express2 = require('express');
      const app = await Promise.race([
        (async () => {
          const a = await createNestApp(express2());
          await a.init();
          return a;
        })(),
        new Promise((_, r) =>
          setTimeout(() => r(new Error('BOOTSTRAP_TIMEOUT_25s')), 25000),
        ),
      ]);
      const mongoose = require('mongoose');
      const ready = mongoose.connection.readyState;
      await app.close().catch(() => {});
      return res
        .status(200)
        .end(JSON.stringify({ ok: true, ms: Date.now() - start, mongoReadyState: ready }));
    } catch (e) {
      return res.status(200).end(
        JSON.stringify({
          ok: false,
          ms: Date.now() - start,
          error: e && e.message ? e.message : String(e),
          stack: e && e.stack ? e.stack.split('\n').slice(0, 6) : null,
        }),
      );
    }
  }

  if (req.url && req.url.includes('__diag')) {
    const start = Date.now();
    const mask = (u) => (u || '').replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
    res.setHeader('Content-Type', 'application/json');
    try {
      const dns = require('dns');
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      const mongoose = require('mongoose');
      const uri = process.env.DATABASE_URL || '';
      const conn = await mongoose
        .createConnection(uri, { serverSelectionTimeoutMS: 8000 })
        .asPromise();
      const users = await conn.db.collection('users').countDocuments();
      await conn.close();
      return res.status(200).end(
        JSON.stringify({
          ok: true,
          ms: Date.now() - start,
          users,
          uri: mask(uri),
          vercel: !!process.env.VERCEL,
          node: process.version,
        }),
      );
    } catch (e) {
      return res.status(200).end(
        JSON.stringify({
          ok: false,
          ms: Date.now() - start,
          error: e && e.message ? e.message : String(e),
          code: e && e.code ? e.code : null,
          uri_present: !!process.env.DATABASE_URL,
          uri: mask(process.env.DATABASE_URL || ''),
        }),
      );
    }
  }

  // Positionne les en-têtes CORS dès l'entrée dans la fonction serverless,
  // avant que Vercel ou NestJS ne puisse les écraser / vider.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
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
    // Sinon une panne transitoire au demarrage a froid (ex. resolution DNS
    // Atlas lente) fige l'instance en erreur 500 pour toutes les requetes
    // suivantes. En cas d'echec on reinitialise pour reessayer a la prochaine
    // invocation.
    bootstrapPromise = bootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }

  try {
    await bootstrapPromise;
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error('[bootstrap] Echec du demarrage de l\'application :', detail);
    res.setHeader('Content-Type', 'application/json');
    // On expose le message d'erreur de demarrage (typiquement une erreur de
    // connexion MongoDB) pour faciliter le diagnostic sans acceder aux logs
    // Vercel : ETIMEDOUT => IP non autorisee dans Atlas ; "authentication
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
