/* eslint-disable */
// Seed de 5 catégories avec de VRAIES images uploadées sur Cloudinary.
//
//   node scripts/seed-categories.js
//
// - _id imposés (fournis par l'utilisateur)
// - image = URL Cloudinary réelle (upload depuis ce script)
// - order généré (1..5)

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CATEGORIES = [
  { _id: '69ef2d48e6e9c0bc2ded992f', name: 'Protection Réseau' },
  { _id: '69ef38f5bd966bfefbd00f83', name: 'Sécurité Endpoint' },
  { _id: '69ef392abd966bfefbd00f9a', name: 'Sécurité Cloud' },
  { _id: '69ef3addbd966bfefbd0104a', name: 'Conformité & Audit' },
  { _id: '69ef3ba7bd966bfefbd010f4', name: 'Surveillance & Réponse' },
];

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (error, uploaded) => {
        if (error) return reject(error);
        if (!uploaded) return reject(new Error('Upload Cloudinary échoué'));
        resolve(uploaded.secure_url);
      },
    );
    stream.end(buffer);
  });
}

async function fetchImageBuffer(seed) {
  const res = await fetch(`https://picsum.photos/seed/${seed}/800/600`);
  if (!res.ok) throw new Error(`Téléchargement ${seed} échoué (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  const now = new Date();

  // 1. Upload d'une image Cloudinary par catégorie
  console.log('⏫ Upload des images de catégories sur Cloudinary...');
  for (let i = 0; i < CATEGORIES.length; i++) {
    const buf = await fetchImageBuffer(`cyna-cat-${i}`);
    CATEGORIES[i].image = await uploadBuffer(buf);
    console.log(`   ${i + 1}/${CATEGORIES.length} → ${CATEGORIES[i].image}`);
  }

  // 2. Insertion en base avec les _id imposés
  const client = await MongoClient.connect(process.env.DATABASE_URL);
  try {
    const db = client.db();
    const col = db.collection('categories');

    const docs = CATEGORIES.map((c, i) => ({
      _id: new ObjectId(c._id),
      name: c.name,
      slug: slugify(c.name),
      image: c.image,
      description: `${c.name} — ensemble de solutions CYNA pour ce domaine de cybersécurité.`,
      order: i + 1, // 1..5
      createdAt: now,
      updatedAt: now,
    }));

    // Idempotent : on supprime d'abord ces _id s'ils existent déjà.
    await col.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    const res = await col.insertMany(docs);
    console.log(`\n✅ ${res.insertedCount} catégories insérées.`);
    docs.forEach((d) =>
      console.log(`   - [${d.order}] ${d.name} (${d.slug})`),
    );
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error('❌ Échec :', e.message);
  process.exit(1);
});
