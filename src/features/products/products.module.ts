import { forwardRef, Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './entities/product.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';
import { SharedService } from 'src/shared/services/shared.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),

    forwardRef(() => CategoriesModule),
    UsersModule,
    forwardRef(() => ServicesModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, SharedService, JwtService, CloudinaryService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
