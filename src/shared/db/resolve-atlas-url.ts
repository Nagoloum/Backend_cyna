import { promises as dnsPromises } from 'dns';
import { execSync } from 'child_process';

// Resolution DNS Atlas partagee. Transforme une URL `mongodb+srv://` en URL
// `mongodb://` directe (hotes resolus en dur), utile la ou la resolution SRV
// native echoue (local Windows, certains runtimes serverless). Tolerant aux
// pannes : renvoie l'URL d'origine si la resolution echoue.
//
// Utilise a la fois par main.ts (log de diagnostic) et par le factory
// MongooseModule.forRootAsync (app.module) afin que la connexion utilise
// REELLEMENT l'URL resolue (le forRoot synchrone capturait l'URL trop tot).

function srvViaPowerShell(
  srvHost: string,
): Array<{ name: string; port: number }> {
  try {
    const raw = execSync(
      `powershell -NoProfile -Command "Resolve-DnsName ${srvHost} -Type SRV | ForEach-Object { $_.NameTarget + ':' + $_.Port }"`,
      { encoding: 'utf8', timeout: 15000 },
    );
    return raw
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const idx = l.lastIndexOf(':');
        return {
          name: l.slice(0, idx),
          port: parseInt(l.slice(idx + 1)) || 27017,
        };
      });
  } catch {
    return [];
  }
}

function txtViaPowerShell(host: string): string {
  try {
    const raw = execSync(
      `powershell -NoProfile -Command "Resolve-DnsName ${host} -Type TXT | Select-Object -ExpandProperty Strings"`,
      { encoding: 'utf8', timeout: 10000 },
    );
    const lines = raw
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return (
      lines.find((l) => l.includes('authSource') || l.includes('replicaSet')) ??
      ''
    );
  } catch {
    return '';
  }
}

export async function resolveAtlasUrl(url: string): Promise<string> {
  if (!url?.startsWith('mongodb+srv://')) return url;

  const withoutProto = url.slice('mongodb+srv://'.length);
  const atIdx = withoutProto.lastIndexOf('@');
  const credentials = withoutProto.slice(0, atIdx);
  const rest = withoutProto.slice(atIdx + 1);
  const slashIdx = rest.indexOf('/');
  const host = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const dbAndParams = slashIdx === -1 ? '' : rest.slice(slashIdx + 1);
  const [db, existingParams] = dbAndParams.split('?');

  let srvRecords: Array<{ name: string; port: number }> = [];
  let txtOpts = '';

  try {
    // Timeout de securite : la resolution SRV native n'a pas de timeout propre
    // et pourrait faire pendre le demarrage a froid serverless. On la borne a 6s.
    const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), ms),
        ),
      ]);
    const [srv, txt] = await Promise.all([
      withTimeout(dnsPromises.resolveSrv(`_mongodb._tcp.${host}`), 6000),
      withTimeout(dnsPromises.resolveTxt(host), 6000).catch(
        () => [] as string[][],
      ),
    ]);
    srvRecords = srv.map((r) => ({ name: r.name, port: r.port }));
    for (const record of txt) {
      const s = Array.isArray(record) ? record.join('') : record;
      if (s.includes('authSource') || s.includes('replicaSet')) {
        txtOpts = s;
        break;
      }
    }
    console.log(`[Atlas] DNS c-ares OK → ${srvRecords.length} hôtes`);
  } catch {
    console.log('[Atlas] c-ares échoué, fallback PowerShell...');
    srvRecords = srvViaPowerShell(`_mongodb._tcp.${host}`);
    txtOpts = txtViaPowerShell(host);
    if (srvRecords.length > 0) {
      console.log(`[Atlas] PowerShell OK → ${srvRecords.length} hôtes`);
    }
  }

  if (srvRecords.length === 0) {
    // Resolution impossible : on renvoie l'URL d'origine et on laisse le driver
    // Mongoose tenter sa propre resolution SRV (fonctionne sur Linux/Vercel).
    console.error('[Atlas] Résolution SRV impossible → URL sr:// d\'origine utilisée');
    return url;
  }

  const hosts = srvRecords
    .sort((a, b) => a.port - b.port)
    .map((r) => `${r.name}:${r.port}`)
    .join(',');

  // Deduplication des parametres : `existingParams` (retryWrites/w) et surtout
  // `txtOpts` (TXT Atlas) contiennent deja `authSource`/`replicaSet`. Sans
  // deduplication, `authSource` apparaissait DEUX FOIS et le driver MongoDB
  // rejetait l'URL (« URI option authSource cannot appear more than once »)
  // -> connexion echouee -> 500. On fusionne dans une map (cles uniques).
  const paramMap = new Map<string, string>();
  const addParams = (raw: string) => {
    for (const pair of raw.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? '' : pair.slice(eq + 1);
      if (key) paramMap.set(key, value);
    }
  };
  addParams('ssl=true&authSource=admin');
  if (existingParams) addParams(existingParams);
  if (txtOpts) addParams(txtOpts);

  const query = Array.from(paramMap.entries())
    .map(([k, v]) => (v === '' ? k : `${k}=${v}`))
    .join('&');

  const directUrl = `mongodb://${credentials}@${hosts}/${db}?${query}`;
  console.log(`[Atlas] Connexion directe construite (${srvRecords.length} hôtes)`);
  return directUrl;
}
