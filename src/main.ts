import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableCors();
  // prefix API
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // optionnel : pour éviter certains messages bizarres
      forbidUnknownValues: false,
    }),
  );
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
  // Rend le dossier storage accessible publiquement
  app.useStaticAssets(join(__dirname, '..', 'storage'), {
    prefix: '/storage/',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
