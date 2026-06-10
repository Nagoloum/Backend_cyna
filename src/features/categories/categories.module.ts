import { forwardRef, Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category, CategorySchema } from './entities/category.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';
import { SharedService } from 'src/shared/services/shared.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { Product } from '../products/entities/product.entity';
import { ProductsModule } from '../products/products.module';
import { Service } from '../services/entities/service.entity';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
    UsersModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => ServicesModule),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, JwtService, SharedService, CloudinaryService],
  exports: [CategoriesService, MongooseModule],
})
export class CategoriesModule {}
