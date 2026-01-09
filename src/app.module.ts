import { Module } from '@nestjs/common';

import { config } from 'dotenv';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './features/users/users.module';
import { AuthModule } from './features/auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { ProductsModule } from './products/products.module';

config();
@Module({
  imports: [
    MongooseModule.forRoot(`${process.env.DATABASE_URL}`),
    UsersModule,
    AuthModule,
    CategoriesModule,
    ServicesModule,
    ProductsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
