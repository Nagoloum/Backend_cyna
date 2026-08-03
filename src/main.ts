import * as dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { initSentry } from './shared/sentry';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Initialise Sentry au plus tôt (no-op sans SENTRY_DSN).
initSentry();

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
  // La resolution DNS Atlas est desormais faite dans MongooseModule.forRootAsync
  // (app.module.ts) : la connexion utilise ainsi REELLEMENT l'URL resolue au
  // moment ou elle est etablie (le forRoot synchrone capturait l'URL trop tot).

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
  // plusieurs origines séparées par des virgules acceptées). Le front de
  // production (Vercel) est toujours autorisé en plus des origines locales.
  const allowedOrigins = [
    ...new Set(
      (
        (process.env.FRONTEND_URL ?? '') +
        ',http://localhost:5173,http://localhost,https://cynaapp.vercel.app'
      )
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Expose l'en-tête métier + autorise les cookies cross-origin (withCredentials).
    exposedHeaders: ['X-App-Error'],
    credentials: true,
  });

  // Analyse les cookies de chaque requête entrante (nécessaire pour le mode
  // httpOnly cookie — le JWT est lu depuis req.cookies.accessToken).
  app.use(cookieParser());

  // prefix API
  app.setGlobalPrefix('api');
  // whitelist : supprime silencieusement les champs absents des DTOs
  // (anti mass-assignment) ; transform : caste les types déclarés.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

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
