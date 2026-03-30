import { Module } from '@nestjs/common';

import { config } from 'dotenv';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './features/users/users.module';
import { AuthModule } from './features/auth/auth.module';
import { CategoriesModule } from './features/categories/categories.module';
import { ServicesModule } from './features/services/services.module';
import { ProductsModule } from './features/products/products.module';
import { SlidersModule } from './features/sliders/sliders.module';
import { CarteBancairesModule } from './features/carte_bancaires/carte_bancaires.module';
import { AdresseFacturationsModule } from './features/adresse_facturations/adresse_facturations.module';

config();
@Module({
  imports: [
    MongooseModule.forRoot(`${process.env.DATABASE_URL}`),
    UsersModule,
    AuthModule,
    CategoriesModule,
    ServicesModule,
    ProductsModule,
    SlidersModule,
    CarteBancairesModule,
    AdresseFacturationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
