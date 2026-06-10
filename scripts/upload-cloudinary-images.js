/* eslint-disable */
// Upload de VRAIES images sur Cloudinary, puis mise à jour des 20 produits
// existants pour remplacer leurs images par les URLs Cloudinary obtenues.
//
//   node scripts/upload-cloudinary-images.js
//
// Reproduit exactement le comportement de CloudinaryService.uploadBuffer :
// aucun dossier, public_id généré par Cloudinary, resource_type image.

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Pool d'images sources distinctes (vraies photos, libres). On les upload une
// fois sur Cloudinary puis on les répartit (3 à 5) sur chaque produit.
const POOL_SIZE = 12;

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
  const url = `https://picsum.photos/seed/${seed}/800/600`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement ${seed} échoué (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  // 1. Upload du pool d'images sur Cloudinary
  console.log(`⏫ Upload de ${POOL_SIZE} images sur Cloudinary...`);
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const buf = await fetchImageBuffer(`cyna-cloud-${i}`);
    const url = await uploadBuffer(buf);
    pool.push(url);
    console.log(`   ${i + 1}/${POOL_SIZE} → ${url}`);
  }

  // 2. Mise à jour des produits
  const client = await MongoClient.connect(process.env.DATABASE_URL);
  try {
    const db = client.db();
    const col = db.collection('products');
    const products = await col.find({}).sort({ _id: 1 }).toArray();
    console.log(`\n🔄 Mise à jour de ${products.length} produits...`);

    let updated = 0;
    for (let i = 0; i < products.length; i++) {
      const imageCount = 3 + (i % 3); // 3 à 5 images
      const images = Array.from({ length: imageCount }, (_, k) => ({
        _id: new ObjectId(),
        url: pool[(i + k) % pool.length], // rotation dans le pool
      }));

      await col.updateOne(
        { _id: products[i]._id },
        { $set: { images, updatedAt: new Date() } },
      );
      updated++;
    }

    console.log(`✅ ${updated} produits mis à jour avec des images Cloudinary.`);
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error('❌ Échec :', e.message);
  process.exit(1);
});
