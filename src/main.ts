import * as dns from 'dns';
import { promises as dnsPromises } from 'dns';
import { execSync } from 'child_process';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

function srvViaPowerShell(srvHost: string): Array<{ name: string; port: number }> {
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
        return { name: l.slice(0, idx), port: parseInt(l.slice(idx + 1)) || 27017 };
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
    const lines = raw.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.find((l) => l.includes('authSource') || l.includes('replicaSet')) ?? '';
  } catch {
    return '';
  }
}

async function resolveAtlasUrl(url: string): Promise<string> {
  if (!url?.startsWith('mongodb+srv://')) return url;

  const withoutProto = url.slice('mongodb+srv://'.length);
  const atIdx = withoutProto.lastIndexOf('@');
  const credentials = withoutProto.slice(0, atIdx);
  const rest = withoutProto.slice(atIdx + 1);
  const slashIdx = rest.indexOf('/');
  const host = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const dbAndParams = slashIdx === -1 ? '' : rest.slice(slashIdx + 1);
  const [db, existingParams] = dbAndParams.split('?');

  // Attempt 1 Node.js c-ares with Google DNS
  let srvRecords: Array<{ name: string; port: number }> = [];
  let txtOpts = '';

  try {
    const [srv, txt] = await Promise.all([
      dnsPromises.resolveSrv(`_mongodb._tcp.${host}`),
      dnsPromises.resolveTxt(host).catch(() => [] as string[][]),
    ]);
    srvRecords = srv.map((r) => ({ name: r.name, port: r.port }));
    for (const record of txt) {
      const s = Array.isArray(record) ? record.join('') : record;
      if (s.includes('authSource') || s.includes('replicaSet')) { txtOpts = s; break; }
    }
    console.log(`[Atlas] DNS c-ares OK → ${srvRecords.length} hôtes`);
  } catch {
    // Attempt 2 PowerShell fallback (Windows only)
    console.log('[Atlas] c-ares échoué, fallback PowerShell...');
    srvRecords = srvViaPowerShell(`_mongodb._tcp.${host}`);
    txtOpts = txtViaPowerShell(host);
    if (srvRecords.length > 0) {
      console.log(`[Atlas] PowerShell OK → ${srvRecords.length} hôtes`);
    }
  }

  if (srvRecords.length === 0) {
    console.error('[Atlas] Résolution SRV impossible URL originale utilisée');
    return url;
  }

  const hosts = srvRecords
    .sort((a, b) => a.port - b.port)
    .map((r) => `${r.name}:${r.port}`)
    .join(',');

  const parts: string[] = ['ssl=true', 'authSource=admin'];
  if (existingParams) parts.push(existingParams);
  if (txtOpts) parts.push(txtOpts);

  const directUrl = `mongodb://${credentials}@${hosts}/${db}?${parts.join('&')}`;
  console.log(`[Atlas] Connexion directe construite (${srvRecords.length} hôtes)`);
  return directUrl;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

/**
 * Crée et configure l'application NestJS.
 *
 * @param expressInstance  instance Express existante (utilisée par le handler
 *   serverless Vercel). Si absente, Nest crée sa propre instance (mode local).
 *
 * NB : cette fonction n'appelle NI `listen()` NI `init()`. C'est à l'appelant
 * de choisir : `listen()` en local, `init()` en serverless.
 */
export async function createNestApp(
  expressInstance?: unknown,
): Promise<NestExpressApplication> {
  // Contournement DNS Atlas (utile en local Windows ; no-op si l'URL n'est
  // pas en mongodb+srv://).
  process.env.DATABASE_URL = await resolveAtlasUrl(process.env.DATABASE_URL ?? '');

  const app = expressInstance
    ? await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(expressInstance as any),
        { rawBody: true },
      )
    : await NestFactory.create<NestExpressApplication>(AppModule, {
        rawBody: true,
      });

  // Headers de sécurité HTTP. CSP désactivée (API JSON, pas de pages HTML
  // hormis Swagger qui charge ses assets depuis un CDN).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS restreint aux origines connues (configurable via FRONTEND_URL,
  // plusieurs origines séparées par des virgules acceptées).
  const allowedOrigins = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173,http://localhost'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // prefix API
  app.setGlobalPrefix('api');
  // whitelist : supprime silencieusement les champs absents des DTOs
  // (anti mass-assignment) ; transform : caste les types déclarés.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // === Swagger Configuration ===
  // Actif par défaut (la doc est déployée sur Vercel) ; mettre
  // SWAGGER_ENABLED=false pour la couper en production si besoin.
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('CYNA API')
      .setDescription('The CYNA API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // Sur Vercel (serverless), les assets statiques de Swagger UI ne sont pas
    // embarqués dans la fonction → on les charge depuis un CDN (même version que
    // swagger-ui-dist installé) pour que la page /api/docs s'affiche correctement.
    const SWAGGER_UI_VERSION = '5.30.2';
    const SWAGGER_CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;
    SwaggerModule.setup('api/docs', app, document, {
      customCssUrl: `${SWAGGER_CDN}/swagger-ui.css`,
      customJs: [
        `${SWAGGER_CDN}/swagger-ui-bundle.js`,
        `${SWAGGER_CDN}/swagger-ui-standalone-preset.js`,
      ],
      swaggerOptions: {
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // NB : le stockage local des images (dossier `storage/`) a été remplacé par
  // Cloudinary (cf. CloudinaryService) car le système de fichiers est en
  // lecture seule sur Vercel.

  return app;
}

async function bootstrap() {
  const app = await createNestApp();
  await app.listen(process.env.PORT ?? 3000);
}

// En local / hébergement classique : on démarre un serveur HTTP.
// Sur Vercel (serverless), c'est `api/index.js` qui pilote l'app, donc on
// n'appelle pas listen() pour éviter d'ouvrir un port.
if (!process.env.VERCEL) {
  bootstrap();
}
