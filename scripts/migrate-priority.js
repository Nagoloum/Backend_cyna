// Migration one-shot : renomme le champ `priority` en `is_selected` sur tous les produits.
const dns       = require('dns');
const { promises: dnsPromises } = require('dns');
const { execSync } = require('child_process');
const mongoose  = require('mongoose');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

function srvViaPowerShell(srvHost) {
  try {
    const raw = execSync(
      `powershell -NoProfile -Command "Resolve-DnsName ${srvHost} -Type SRV | ForEach-Object { $_.NameTarget + ':' + $_.Port }"`,
      { encoding: 'utf8', timeout: 15000 },
    );
    return raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const idx = l.lastIndexOf(':');
      return { name: l.slice(0, idx), port: parseInt(l.slice(idx + 1)) || 27017 };
    });
  } catch { return []; }
}

function txtViaPowerShell(host) {
  try {
    const raw = execSync(
      `powershell -NoProfile -Command "Resolve-DnsName ${host} -Type TXT | Select-Object -ExpandProperty Strings"`,
      { encoding: 'utf8', timeout: 10000 },
    );
    const lines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.find(l => l.includes('authSource') || l.includes('replicaSet')) ?? '';
  } catch { return ''; }
}

async function resolveAtlasUrl(url) {
  if (!url?.startsWith('mongodb+srv://')) return url;
  const withoutProto = url.slice('mongodb+srv://'.length);
  const atIdx        = withoutProto.lastIndexOf('@');
  const credentials  = withoutProto.slice(0, atIdx);
  const rest         = withoutProto.slice(atIdx + 1);
  const slashIdx     = rest.indexOf('/');
  const host         = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const dbAndParams  = slashIdx === -1 ? '' : rest.slice(slashIdx + 1);
  const [db, existingParams] = dbAndParams.split('?');

  let srvRecords = [];
  let txtOpts    = '';

  try {
    const [srv, txt] = await Promise.all([
      dnsPromises.resolveSrv(`_mongodb._tcp.${host}`),
      dnsPromises.resolveTxt(host).catch(() => []),
    ]);
    srvRecords = srv.map(r => ({ name: r.name, port: r.port }));
    for (const record of txt) {
      const s = Array.isArray(record) ? record.join('') : record;
      if (s.includes('authSource') || s.includes('replicaSet')) { txtOpts = s; break; }
    }
    console.log(`[DNS] c-ares OK → ${srvRecords.length} hôte(s)`);
  } catch {
    console.log('[DNS] c-ares échoué, fallback PowerShell…');
    srvRecords = srvViaPowerShell(`_mongodb._tcp.${host}`);
    txtOpts    = txtViaPowerShell(host);
    if (srvRecords.length) console.log(`[DNS] PowerShell OK → ${srvRecords.length} hôte(s)`);
  }

  if (!srvRecords.length) {
    console.log('[DNS] Résolution SRV impossible, URL originale utilisée.');
    return url;
  }

  const hosts = srvRecords.sort((a, b) => a.port - b.port).map(r => `${r.name}:${r.port}`).join(',');
  console.log(`[DNS] txtOpts = "${txtOpts}"`);
  // Fusionne tous les paramètres sans doublons de clés.
  // L'ordre d'ajout détermine la priorité (dernier gagne) :
  //   defaults < existingParams < TXT record
  const paramMap = new Map();
  const addParams = str => str && str.split('&').forEach(p => { const [k, v] = p.split('='); if (k) paramMap.set(k, v ?? ''); });
  addParams('tls=true');
  addParams(existingParams);
  addParams(txtOpts);
  const query = [...paramMap.entries()].map(([k, v]) => v ? `${k}=${v}` : k).join('&');
  console.log(`[DNS] URL directe : mongodb://<creds>@${hosts}/${db}?${query}`);
  return `mongodb://${credentials}@${hosts}/${db}?${query}`;
}

async function run() {
  const srvUrl = process.env.DATABASE_URL;
  if (!srvUrl) { console.error('DATABASE_URL manquant'); process.exit(1); }

  console.log('Résolution DNS…');
  const url = await resolveAtlasUrl(srvUrl);

  console.log('Connexion à MongoDB…');
  await mongoose.connect(url);

  const result = await mongoose.connection.db.collection('products').updateMany(
    {},
    [
      { $set:   { is_selected: '$priority' } },
      { $unset: 'priority' },
    ],
  );

  console.log(`Migration terminée : ${result.matchedCount} correspondants, ${result.modifiedCount} modifiés.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
