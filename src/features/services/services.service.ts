import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SharedService } from 'src/shared/services/shared.service';
import { Service } from './entities/service.entity';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { CategoriesService } from '../categories/categories.service';
import { resolveIdOrThrow } from 'src/shared/generic/resolveId';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    private readonly sharedService: SharedService,
    private readonly categoryService: CategoriesService,
  ) {}
  async create(createServiceDto: CreateServiceDto) {
    try {
      const existingService = await this.serviceModel.exists({
        name: createServiceDto.name,
      });
      if (existingService) {
        return ApiResponse.error('Ce service existe deja');
      }
      const slug = this.sharedService.generateSlug(createServiceDto.name);
      const categoryId = await resolveIdOrThrow(
        createServiceDto.categoryId,
        (id) => this.categoryService.findOneById(id),
        'Catégorie',
      );

      const createdService = new this.serviceModel({
        ...createServiceDto,
        slug,
        category: categoryId,
      });
      const savedService = await createdService.save();
      return ApiResponse.success('Service crée', savedService);
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la création du service : ' + error.message,
      );
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
        this.serviceModel
          .find(whereQuery)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.serviceModel.countDocuments(whereQuery).exec(),
      ]);

      return ApiResponse.success('Liste des services', {
        data,
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des services');
    }
  }
  async findOneById(id: string): Promise<{ _id: Types.ObjectId } | null> {
    return await this.serviceModel.findOne({ _id: id }, '_id');
  }
  async findOne(slug: string) {
    try {
      const service = await this.serviceModel.findOne({ slug });
      if (!service) {
        return ApiResponse.error('Service non trouvé');
      }
      return ApiResponse.success('Service récupéré avec succès', service);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération du service');
    }
  }

  async update(slug: string, updateServiceDto: UpdateServiceDto) {
    try {
      const categoryId = await resolveIdOrThrow(
        updateServiceDto.categoryId,
        (id) => this.categoryService.findOneById(id),
        'Catégorie',
      );
      const service = await this.serviceModel.findOneAndUpdate(
        { slug },
        { ...updateServiceDto, category: categoryId },
        { new: true },
      );
      if (!service) {
        return ApiResponse.error('Service non trouvé');
      }
      return ApiResponse.success('Service mis à jour avec succès', service);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la mise à jour du service');
    }
  }
  async remove(slug: string) {
    try {
      const service = await this.serviceModel.findOneAndDelete({ slug });
      if (!service) {
        return ApiResponse.error('Service non trouvé');
      }
      return ApiResponse.success('Service supprimé avec succès');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la suppression du service');
    }
  }
}
