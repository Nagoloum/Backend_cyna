import * as dns from 'dns';

// Force des serveurs DNS publics : la resolution SRV d'Atlas echoue avec
// certains resolveurs (constate en local sous Windows). Doit etre fait avant
// toute resolution DNS du driver MongoDB.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { initSentry } from './shared/sentry';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Initialise Sentry au plus tot (no-op sans SENTRY_DSN).
initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // rawBody est requis pour verifier la signature des webhooks Stripe.
    rawBody: true,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // Headers de sécurité HTTP. CSP désactivée : API JSON, pas de pages HTML
  // hormis Swagger (réservé au développement).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS restreint aux origines connues (configurable via FRONTEND_URL,
  // plusieurs origines séparées par des virgules acceptées). Les origines
  // locales ne sont autorisées qu'en dehors de la production.
  const devOrigins = isProduction
    ? ''
    : ',http://localhost:5173,http://localhost';
  const allowedOrigins = [
    ...new Set(
      (
        (process.env.FRONTEND_URL ?? '') +
        ',https://cynaapp.vercel.app' +
        devOrigins
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
  // httpOnly cookie : le JWT est lu depuis req.cookies.accessToken).
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  // whitelist : supprime silencieusement les champs absents des DTOs
  // (anti mass-assignment) ; transform : caste les types déclarés.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Swagger : actif par défaut en développement, désactivé par défaut en
  // production (la documentation complète de l'API ne doit pas être exposée
  // publiquement). Forçage possible dans les deux sens via SWAGGER_ENABLED.
  const swaggerEnabled = isProduction
    ? process.env.SWAGGER_ENABLED === 'true'
    : process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('CYNA API')
      .setDescription('API du site e-commerce Cyna')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
