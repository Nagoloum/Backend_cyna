import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { ServicesService } from '../services/services.service';
import { Product } from './entities/product.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { resolveIdOrThrow } from 'src/shared/generic/resolveId';
import { QueryDto } from 'src/shared/dto/query.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly sharedService: SharedService,
    private readonly servicesService: ServicesService,
  ) {}
  async create(createProductDto: CreateProductDto) {
    try {
      const service = await this.productModel.exists({
        slug: createProductDto.slug,
      });
      if (!service) {
        return ApiResponse.error('Service not found');
      }
      createProductDto.slug = this.sharedService.generateSlug(
        createProductDto.name,
      );
      const serviceId = resolveIdOrThrow(
        createProductDto.serviceId,
        (id) => this.servicesService.findOneById(id),
        'Service',
      );
      const createdProduct = new this.productModel({
        ...createProductDto,
        service: serviceId,
      });
      const savedProduct = await createdProduct.save();
      return ApiResponse.success('Produit crée avec succès', savedProduct);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la création du produit');
    }
  }

  async findAll(queryDto: QueryDto) {
    try {
      const { page = 1, limit = 10, search, sortBy, sortOrder } = queryDto;
      const skip = (page - 1) * limit;

      const whereQuery: any = {};

      if (search) {
        whereQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ];
      }

      const allowedSortFields = new Set(['name', 'slug']);
      const selectedSortField =
        sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
      const selectedSortOrder: 1 | -1 =
        typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc'
          ? 1
          : -1;
      const sortQuery: Record<string, 1 | -1> = {
        [selectedSortField]: selectedSortOrder,
        name: 1,
      };

      const [data, total] = await Promise.all([
        this.productModel
          .find(whereQuery)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.productModel.countDocuments(whereQuery).exec(),
      ]);

      return ApiResponse.success('Liste des produits', {
        data,
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des produits');
    }
  }

  async findOne(id: string) {
    try {
      const product = await this.productModel.findOne({ _id: id }).exec();
      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }
      return ApiResponse.success('Produit récupéré avec succès', product);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération du produit');
    }
  }

  async update(slug: string, updateProductDto: UpdateProductDto) {
    try {
      const serviceId = resolveIdOrThrow(
        updateProductDto.serviceId,
        (id) => this.servicesService.findOneById(id),
        'Service',
      );
      const product = await this.productModel.findOneAndUpdate(
        { slug },
        { ...updateProductDto, service: serviceId },
        { new: true },
      );
      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }
      return ApiResponse.success('Produit mis à jour avec succès', product);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la mise à jour du produit');
    }
  }

  async remove(slug: string) {
    try {
      const product = await this.productModel.findOneAndDelete({ slug });
      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }
      return ApiResponse.success('Produit supprimé avec succès');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la suppression du produit');
    }
  }
}
