// Point d'entrée serverless pour Vercel.
//
// On importe l'application NestJS DÉJÀ COMPILÉE (`dist/main.js`) plutôt que les
// sources TypeScript : la compilation est faite en amont par `npm run build`
// (buildCommand dans vercel.json), ce qui garantit que les métadonnées des
// décorateurs (DI NestJS) sont bien émises.
//
// L'app est bootstrappée UNE SEULE FOIS puis mise en cache entre les
// invocations, pour réutiliser la connexion MongoDB (important en serverless).

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
