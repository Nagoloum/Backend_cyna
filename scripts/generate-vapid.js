/**
 * Génère une paire de clés VAPID pour les notifications push Web.
 *
 * Usage : node scripts/generate-vapid.js
 *
 * Copiez les trois lignes générées dans votre .env backend (ou dans les
 * variables d'environnement Vercel du back). La clé publique doit aussi être
 * ajoutée dans le .env frontend sous VITE_VAPID_PUBLIC_KEY.
 */
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('');
console.log('# ── Clés VAPID (push notifications) ─────────────────────');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_EMAIL=mailto:support@example.com   # remplacer par votre email');
console.log('');
console.log('# Pour le frontend :');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('');
console.log('⚠  Stockez VAPID_PRIVATE_KEY en sécurité — ne la commitez jamais.');
