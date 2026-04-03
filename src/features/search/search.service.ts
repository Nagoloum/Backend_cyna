import { Injectable } from '@nestjs/common';
import { CreateSearchDto } from './dto/create-search.dto';
import { Product } from '../products/entities/product.entity';
import { Model, Types } from 'mongoose'; // Import de Types pour la conversion
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

 // ... (imports identiques)

  async advancedSearch(dto: CreateSearchDto) {
    const pipeline: any[] = [];

    // 1. JOINTURES
    pipeline.push(
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'service_info',
        },
      },
      { $unwind: '$service_info' },
      {
        $lookup: {
          from: 'categories',
          localField: 'service_info.category',
          foreignField: '_id',
          as: 'category_info',
        },
      },
      { $unwind: { path: '$category_info', preserveNullAndEmptyArrays: true } }
    );

    // 2. FILTRAGE
    const match: any = {
      stock: { $gt: 0 },
      'service_info.available': true
    };

    // Filtrage multi-catégories (Correction ici)
    if (dto.categories && dto.categories.length > 0) {
      // On filtre les IDs valides pour éviter le crash de Types.ObjectId
      const categoryObjectIds = dto.categories
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));

      if (categoryObjectIds.length > 0) {
        match['category_info._id'] = { $in: categoryObjectIds };
      }
    }

    // Filtrage multi-services (Correction ici)
    if (dto.services && dto.services.length > 0) {
      const serviceObjectIds = dto.services
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));

      if (serviceObjectIds.length > 0) {
        match['service_info._id'] = { $in: serviceObjectIds };
      }
    }

    // Filtres de prix
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      match.priceMonth = {};
      if (dto.minPrice !== undefined) match.priceMonth.$gte = Number(dto.minPrice);
      if (dto.maxPrice !== undefined) match.priceMonth.$lte = Number(dto.maxPrice);
    }

    pipeline.push({ $match: match });

    // 3. SCORE DE RECHERCHE (TEXTE) - Inchangé
    if (dto.text) {
      const term = dto.text.toLowerCase().trim();
      const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fuzzyTerm = safeTerm.length > 3 ? safeTerm.slice(0, -1) : safeTerm;

      pipeline.push({
        $addFields: {
          searchScore: {
            $switch: {
              branches: [
                { case: { $or: [{ $eq: [{ $toLower: '$name' }, term] }, { $eq: [{ $toLower: '$service_info.name' }, term] }] }, then: 100 },
                { case: { $or: [{ $regexMatch: { input: '$name', regex: `^${fuzzyTerm}.`, options: 'i' } }, { $regexMatch: { input: '$service_info.name', regex: `^${fuzzyTerm}.`, options: 'i' } }] }, then: 80 },
                { case: { $or: [{ $regexMatch: { input: '$name', regex: `^${safeTerm}`, options: 'i' } }, { $regexMatch: { input: '$service_info.name', regex: `^${safeTerm}`, options: 'i' } }] }, then: 60 },
                { case: { $or: [{ $regexMatch: { input: '$name', regex: safeTerm, options: 'i' } }, { $regexMatch: { input: '$service_info.name', regex: safeTerm, options: 'i' } }] }, then: 30 },
                { case: { $regexMatch: { input: '$service_info.description', regex: safeTerm, options: 'i' } }, then: 10 }
              ],
              default: 0
            }
          }
        }
      });
      pipeline.push({ $match: { searchScore: { $gt: 0 } } });
    } else {
      pipeline.push({ $addFields: { searchScore: 0 } });
    }


    // 5. PAGINATION
    const page = Math.max(1, Number((dto as any).page) || 1);
    const limit = Math.max(1, Number((dto as any).limit) || 10);

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    });

    const [result] = await this.productModel.aggregate(pipeline).exec();

    const total = result.metadata[0]?.total || 0;
    return {
      data: result.data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }
}