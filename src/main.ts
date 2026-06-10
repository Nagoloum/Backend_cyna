import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';

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
  const app = expressInstance
    ? await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(expressInstance as any),
        { rawBody: true },
      )
    : await NestFactory.create<NestExpressApplication>(AppModule, {
        rawBody: true,
      });

  app.enableCors();
  // prefix API
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());

  // === Swagger Configuration ===
  const config = new DocumentBuilder()
    .setTitle('CYNA API')
    .setDescription('The CYNA API description')
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
