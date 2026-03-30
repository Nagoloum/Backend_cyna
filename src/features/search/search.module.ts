import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/entities/product.entity';

@Module({
  imports: [
    // Indispensable pour injecter @InjectModel(Product.name) dans ton service
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema }
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
