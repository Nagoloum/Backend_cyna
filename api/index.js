// Augmente le pool de threads libuv AVANT tout I/O (resolutions DNS concurrentes
// au demarrage). Doit etre defini avant le 1er usage du pool.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '64';

// Point d'entrée serverless pour Vercel.
//
// On importe l'application NestJS DÉJÀ COMPILÉE (`dist/main.js`) : la compilation
// est faite en amont par `npm run build` (buildCommand dans vercel.json).
//
// NOTE : ce déploiement serverless souffre d'un blocage du bootstrap Nest+Mongo
// au démarrage à froid sur Vercel (connexion Mongoose figée en readyState=2
// pendant l'instanciation concurrente des modules). Pour un fonctionnement
// fiable, déployer le backend sur un hébergement PERSISTANT
// (Render/Railway/Fly.io) via `npm run start:prod` — l'app y démarre une seule
// fois, comme en local ou tout fonctionne.

const express = require('express');
const { createNestApp } = require('../dist/main');

const server = express();
let bootstrapPromise = null;

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
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

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
    // Ne pas mettre en cache une promesse de bootstrap echouee (self-heal).
    bootstrapPromise = bootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }

  try {
    await bootstrapPromise;
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error('[bootstrap] Echec du demarrage :', detail);
    res.setHeader('Content-Type', 'application/json');
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
