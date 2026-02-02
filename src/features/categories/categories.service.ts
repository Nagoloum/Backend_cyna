import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from './entities/category.entity';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    private readonly sharedService: SharedService,
  ) {}
  async create(createCategoryDto: CreateCategoryDto) {
    try {
      const existingCategory: Category | null =
        await this.categoryModel.findOne(
          {
            name: createCategoryDto.name,
          },
          '_id order',
        );
      if (existingCategory) {
        return ApiResponse.error('Cette catégorie existe deja');
      }
      /** Vérifier si deux catégories n'ont pas le même ordre */
      const existingCategoryOrder = await this.categoryModel.findOne({
        order: createCategoryDto.order,
      });
      if (existingCategoryOrder) {
        return ApiResponse.error(
          'Une catégorie a déjà cet ordre, veuillez choisir un autre ordre',
        );
      }

      createCategoryDto.slug = this.sharedService.generateSlug(
        createCategoryDto.name,
      );
      const createdCategory = new this.categoryModel(createCategoryDto);
      await createdCategory.save();
      return ApiResponse.success('Catégorie crée', createdCategory);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la création de la catégorie');
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
        this.categoryModel
          .find(whereQuery)
          .skip(skip)
          .limit(limit)
          .sort(sortQuery)
          .exec(),
        this.categoryModel.countDocuments(whereQuery).exec(),
      ]);

      const response = {
        data: data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      return ApiResponse.success('Catégories récupérés avec succès', response);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des catégories');
    }
  }
  async findOneById(id: string): Promise<{ _id: Types.ObjectId } | null> {
    return await this.categoryModel.findOne({ _id: id }, '_id');
  }
  async findOne(slug: string) {
    try {
      const category = await this.categoryModel.findOne({ slug });
      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }
      return ApiResponse.success('Catégorie récupérée avec succès', category);
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la récupération de la catégorie',
      );
    }
  }

  async update(slug: string, updateCategoryDto: UpdateCategoryDto) {
    try {
      const category = await this.categoryModel.findOneAndUpdate(
        { slug },
        updateCategoryDto,
        { new: true },
      );
      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }
      return ApiResponse.success('Catégorie mise à jour avec succès', category);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la mise à jour de la catégorie');
    }
  }

  async remove(slug: string) {
    try {
      const category = await this.categoryModel.findOneAndDelete({ slug });
      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }
      return ApiResponse.success('Catégorie supprimée avec succès');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la suppression de la catégorie');
    }
  }
}
