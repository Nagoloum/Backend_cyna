import { Module } from '@nestjs/common';

import { config } from 'dotenv';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
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

config();
@Module({
  imports: [
    // Rate limiting global : 100 requêtes/min par IP. Des limites plus
    // strictes sont posées avec @Throttle sur les endpoints sensibles
    // (login, register, forgot-password, 2FA, contact).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MongooseModule.forRoot(`${process.env.DATABASE_URL}`),
    UsersModule,
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
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
