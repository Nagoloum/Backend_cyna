/*
 * Sauvegarde de la base MongoDB via `mongodump` (archive gzip).
 *
 * Prérequis : MongoDB Database Tools installés (mongodump dans le PATH) —
 * https://www.mongodb.com/docs/database-tools/installation/
 *
 * Usage :
 *   node scripts/backup.js
 *   BACKUP_DIR=/chemin/backups node scripts/backup.js
 *
 * Le fichier est écrit dans backups/cyna-<timestamp>.gz. Pour une restauration,
 * voir scripts/restore.js. En production sur MongoDB Atlas, les snapshots
 * automatiques d'Atlas restent la solution recommandée ; ce script couvre les
 * sauvegardes manuelles / hors Atlas et l'export local.
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const uri = process.env.DATABASE_URL;
if (!uri) {
  console.error('DATABASE_URL manquant dans .env');
  process.exit(1);
}

const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const archive = path.join(backupDir, `cyna-${stamp}.gz`);

console.log(`Sauvegarde en cours → ${archive}`);
const res = spawnSync(
  'mongodump',
  [`--uri=${uri}`, `--archive=${archive}`, '--gzip'],
  { stdio: 'inherit' },
);

if (res.error) {
  console.error('Echec : mongodump introuvable ? Installez MongoDB Database Tools.');
  console.error(res.error.message);
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`mongodump a échoué (code ${res.status}).`);
  process.exit(res.status || 1);
}
console.log(`✅ Sauvegarde terminée : ${archive}`);
