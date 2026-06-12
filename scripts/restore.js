/*
 * Restauration d'une sauvegarde MongoDB via `mongorestore`.
 *
 * Prérequis : MongoDB Database Tools installés (mongorestore dans le PATH).
 *
 * Usage :
 *   node scripts/restore.js backups/cyna-2026-06-12T10-00-00-000Z.gz
 *
 * ⚠️ --drop : les collections existantes sont SUPPRIMÉES puis recréées à partir
 * de l'archive. À utiliser en connaissance de cause (de préférence sur un
 * environnement de staging avant la production).
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');

const uri = process.env.DATABASE_URL;
if (!uri) {
  console.error('DATABASE_URL manquant dans .env');
  process.exit(1);
}

const archive = process.argv[2];
if (!archive) {
  console.error('Usage : node scripts/restore.js <chemin-archive.gz>');
  process.exit(1);
}
if (!fs.existsSync(archive)) {
  console.error(`Archive introuvable : ${archive}`);
  process.exit(1);
}

console.log(`Restauration depuis ${archive} (--drop) …`);
const res = spawnSync(
  'mongorestore',
  [`--uri=${uri}`, `--archive=${archive}`, '--gzip', '--drop'],
  { stdio: 'inherit' },
);

if (res.error) {
  console.error('Echec : mongorestore introuvable ? Installez MongoDB Database Tools.');
  console.error(res.error.message);
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`mongorestore a échoué (code ${res.status}).`);
  process.exit(res.status || 1);
}
console.log('✅ Restauration terminée.');
