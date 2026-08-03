import { Module } from '@nestjs/common';

import { config } from 'dotenv';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpStatusInterceptor } from './shared/interceptors/http-status.interceptor';
import { MongooseModule } from '@nestjs/mongoose';
import { resolveAtlasUrl } from './shared/db/resolve-atlas-url';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { UsersModule } from './features/users/users.module';
import { AuthModule } from './features/auth/auth.module';
import { CategoriesModule } from './features/categories/categories.module';
import { ServicesModule } from './features/services/services.module';
import { ProductsModule } from './features/products/products.module';
import { SlidersModule } from './features/sliders/sliders.module';
import { CarteBancairesModule } from './features/carte_bancaires/carte_bancaires.module';
import { AdresseFacturationsModule } from './features/adresse_facturations/adresse_facturations.module';
import { SearchModule } from './features/search/search.module';
import { ContactModule } from './features/contact/contact.module';
import { CommandesModule } from './features/commandes/commandes.module';
import { AnalyticsModule } from './shared/analytics.module';
import { AuditModule } from './features/audit/audit.module';
import { CouponsModule } from './features/coupons/coupons.module';
import { PushModule } from './features/push/push.module';
import { HealthModule } from './health/health.module';

config();

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          level: 'info',
          format: isProduction
            ? winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              )
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(
                  ({ level, message, timestamp, context }) =>
                    `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
                ),
              ),
        }),
      ],
    }),
    // Rate limiting global : 100 requêtes/min par IP. Des limites plus
    // strictes sont posées avec @Throttle sur les endpoints sensibles
    // (login, register, forgot-password, 2FA, contact).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // forRootAsync : l'URI est resolue AU MOMENT de la connexion (via
    // resolveAtlasUrl) — le forRoot synchrone capturait `process.env.DATABASE_URL`
    // trop tot et l'URL resolue/corrigee n'etait jamais utilisee.
    // resolveAtlasUrl transforme mongodb+srv:// en mongodb:// direct (hotes
    // resolus, parametres dedupliques -> plus de « authSource » en double qui
    // faisait echouer la connexion et renvoyait un 500 en serverless).
    // Options adaptees au serverless : selection rapide (10s) + peu de retries
    // pour ne pas depasser la limite de 30s de la fonction ; en cas d'echec
    // api/index.js reinitialise et reessaie.
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: await resolveAtlasUrl(process.env.DATABASE_URL ?? ''),
        serverSelectionTimeoutMS: 10000,
        retryAttempts: 2,
        retryDelay: 2000,
      }),
    }),
    AnalyticsModule,
    UsersModule,
    AuditModule,
    AuthModule,
    CategoriesModule,
    ServicesModule,
    ProductsModule,
    SlidersModule,
    CarteBancairesModule,
    AdresseFacturationsModule,
    SearchModule,
    ContactModule,
    CommandesModule,
    CouponsModule,
    PushModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpStatusInterceptor },
  ],
})
export class AppModule {}
