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

async function bootstrap() {
  const app = await createNestApp(server);
  await app.init();
  return app;
}

module.exports = async (req, res) => {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap();
  }
  await bootstrapPromise;
  server(req, res);
};
