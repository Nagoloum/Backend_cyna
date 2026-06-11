/* eslint-disable */
// Script de seed : insère 20 produits dans la collection `products`.
//
//   node scripts/seed-products.js
//
// Règles demandées :
//   - 20 produits, chacun avec au moins 3 images
//   - 5 produits avec priority=true et un champ order numéroté (1..5)
//   - 3 produits avec stock=0, les autres avec un stock généré
//   - priceMonth / priceYear générés
//   - service = l'un des deux ObjectId fournis (en alternance)

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const SERVICE_IDS = [
  '69ef2f50e6e9c0bc2ded9992',
  '69ef3a02bd966bfefbd00fe5',
];

// Vraies images déjà uploadées sur Cloudinary (cf. upload-cloudinary-images.js).
// Réparties (3 à 5) sur chaque produit.
const CLOUDINARY_IMAGES = [
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079147/h9pbqvlyshu6st3lfvds.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079148/xmktcvhwzfsr8tgkmoa5.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079149/nchf0vj49am1d9xuosmo.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079150/wzyblylszvtmuu33nanh.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079150/ztekfxmojtuu55kzfxhk.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079151/pbia7e8hema7rfybg9v8.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079152/soxpjiwfqbpvc6sb11cc.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079153/cp2s4ytelp1tauktngy2.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079153/twfst2d2vews3iokezwe.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079154/eywzgu3kan6kbtcipvd6.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079155/revlaz49m3aiy6vqjxrq.jpg',
  'https://res.cloudinary.com/dhuamwypb/image/upload/v1781079156/hlm1o33ypei7c7eznpyz.jpg',
];

// Indices (0-based) des produits prioritaires et en rupture de stock.
const PRIORITY_INDEXES = new Set([0, 1, 2, 3, 4]); // 5 produits prioritaires
const OUT_OF_STOCK_INDEXES = new Set([5, 6, 7]); // 3 produits stock = 0

const PRODUCT_NAMES = [
  'Pare-feu Nouvelle Génération',
  'Antivirus Endpoint Pro',
  'VPN Sécurisé Entreprise',
  'Détection des Intrusions (IDS)',
  'Surveillance SOC 24/7',
  'Sauvegarde Cloud Chiffrée',
  'Authentification Multifacteur',
  'Audit de Vulnérabilités',
  'Protection Anti-Phishing',
  'Chiffrement des Données',
  'Gestion des Accès (IAM)',
  'Filtrage Web & DNS',
  'Sécurité des Emails',
  'Protection DDoS',
  'Analyse Forensique',
  'Conformité RGPD',
  'Sécurité des API',
  'Test d’Intrusion (Pentest)',
  'Threat Intelligence',
  'Formation Cybersécurité',
];

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildProducts() {
  const now = new Date();
  return PRODUCT_NAMES.map((name, i) => {
    const slug = slugify(name);

    // 3 à 5 images Cloudinary par produit (au moins 3)
    const imageCount = 3 + (i % 3);
    const images = Array.from({ length: imageCount }, (_, k) => ({
      _id: new ObjectId(),
      url: CLOUDINARY_IMAGES[(i + k) % CLOUDINARY_IMAGES.length],
    }));

    // Prix générés
    const priceMonth = Math.round((9 + i * 7.5) * 100) / 100; // 9, 16.5, 24...
    const priceYear = Math.round(priceMonth * 10 * 100) / 100; // ~2 mois offerts

    // Stock
    let stock;
    if (OUT_OF_STOCK_INDEXES.has(i)) {
      stock = 0;
    } else {
      stock = 15 + ((i * 37) % 200); // valeur déterministe variée
    }

    // Priorité + ordre
    const priority = PRIORITY_INDEXES.has(i);
    const order = priority ? i + 1 : 0; // 1..5 pour les prioritaires

    // Service en alternance
    const service = new ObjectId(SERVICE_IDS[i % SERVICE_IDS.length]);

    return {
      name,
      slug,
      description: `${name} — solution de cybersécurité proposée par CYNA pour protéger votre organisation.`,
      images,
      priceMonth,
      priceYear,
      stripePriceMonthId: '',
      stripePriceYearId: '',
      stock,
      priority,
      order,
      service,
      createdAt: now,
      updatedAt: now,
    };
  });
}

(async () => {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL manquant dans .env');
    process.exit(1);
  }

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    // Nettoyage : on repart d'une collection vide (idempotent).
    const del = await db.collection('products').deleteMany({});
    if (del.deletedCount) {
      console.log(`🧹 ${del.deletedCount} produit(s) existant(s) supprimé(s).`);
    }
    const products = buildProducts();
    const res = await db.collection('products').insertMany(products);
    console.log(`✅ ${res.insertedCount} produits insérés dans "${db.databaseName}".`);

    const priority = products.filter((p) => p.priority).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    console.log(`   - prioritaires (priority=true + order) : ${priority}`);
    console.log(`   - en rupture (stock=0) : ${outOfStock}`);
    console.log(`   - images par produit : 3 à 5`);
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error('❌ Échec du seed :', e.message);
  process.exit(1);
});
