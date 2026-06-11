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
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

async function bootstrap() {
  process.env.DATABASE_URL = await resolveAtlasUrl(process.env.DATABASE_URL ?? '');

  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Headers de sécurité HTTP (CSP désactivée : API JSON + images statiques,
  // crossOriginResourcePolicy ouvert pour servir /storage au frontend).
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

  app.setGlobalPrefix('api');
  // whitelist : supprime silencieusement les champs absents des DTOs
  // (anti mass-assignment) ; transform : caste les types déclarés.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger uniquement hors production : la documentation expose la surface
  // d'attaque complète de l'API.
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('CYNA API')
      .setDescription('The CYNA API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { tagsSorter: 'alpha', operationsSorter: 'alpha' },
    });
  }

  app.useStaticAssets(join(__dirname, '..', 'storage'), { prefix: '/storage/' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
