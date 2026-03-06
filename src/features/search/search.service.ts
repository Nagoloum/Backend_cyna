import { Injectable } from '@nestjs/common';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import { Product } from '../products/entities/product.entity';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) { }

  async advancedSearch(dto: CreateSearchDto) {
    const pipeline: any[] = [];
    // Jointure produit via service 
    pipeline.push(
      {
        $lookup: {
          from: 'services', // Nom de ta collection Service en BD
          localField: 'service',
          foreignField: '_id',
          as: 'service_info',
        },
      },
      { $unwind: '$service_info' },
    );
    // --- 2. FILTRAGE DES FACETTES (Points 3, 4, 5, 6) ---
    const match: any = {};

    // Facette 4 : Intervalle de Prix
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      match.priceMonth = {};
      if (dto.minPrice !== undefined) match.priceMonth.$gte = Number(dto.minPrice);
      if (dto.maxPrice !== undefined) match.priceMonth.$lte = Number(dto.maxPrice);
    }
    // Facette 6 : Disponibilité (Stock > 0 ET Service actif)
    if (dto.onlyAvailable) {
      match.stock = { $gt: 0 };
      match['service_info.available'] = true;
    }
    // Facette 3 & 5 : IDs Services et Catégories
    if (dto.services?.length) {
      match.service = { $in: dto.services.map(id => new Types.ObjectId(id)) };
    }
    if (dto.categories?.length) {
      match['service_info.category'] = { $in: dto.categories.map(id => new Types.ObjectId(id)) };
    }
    pipeline.push({ $match: match });


    // Règles de recherches pour le litres
    if (dto.text) {
      const term = dto.text.toLowerCase().trim();
      pipeline.push({
        $addFields: {
          searchScore: {
            $switch: {
              branches: [
                // Priorité 1 : Correspondance exacte sur le nom
                { case: { $eq: [{ $toLower: '$name' }, term] }, then: 100 },
                // Priorité 3 : Commence par
                { case: { $regexMatch: { input: '$name', regex: `^${term}`, options: 'i' } }, then: 60 },
                // Priorité 4 : Contient dans le titre ou la description
                { case: { $regexMatch: { input: '$name', regex: term, options: 'i' } }, then: 30 },
                { case: { $regexMatch: { input: '$service_info.description', regex: term, options: 'i' } }, then: 10 },
              ],
              default: 1,
            },
          },
        },
      });
      pipeline.push({ $match: { searchScore: { $gt: 0 } } });
    }

    // --- 4. TRI DYNAMIQUE (Section VII & VIII) ---
    const sort: any = {};
    const direction = dto.sortOrder === 'desc' ? -1 : 1;

    switch (dto.sortBy) {
      case 'prix':
        sort.priceMonth = direction;
        break;
      case 'nouveauté':
        sort.createdAt = direction;
        break;
      case 'disponibilité':
        sort.stock = -1; // Les plus gros stocks en premier
        break;
      default:
        // Par défaut : Pertinence textuelle > Priorité Back-office > Stock
        if (dto.text) sort.searchScore = -1;
        sort.priority = -1;
        sort.stock = -1;
        break;
    }
    pipeline.push({ $sort: sort });
    return await this.productModel.aggregate(pipeline).exec();
  }
}
