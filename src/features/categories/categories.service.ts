import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from './entities/category.entity';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { Product } from '../products/entities/product.entity';
import { Service } from '../services/entities/service.entity';
@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,

    private readonly sharedService: SharedService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}
  async create(
    createCategoryDto: CreateCategoryDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files.newImage?.[0];
    let uploadedUrl = '';

    try {
      // 1. Vérifications initiales (Nom et Ordre)
      const existingCategory = await this.categoryModel.findOne(
        { name: createCategoryDto.name },
        '_id',
      );
      if (existingCategory) {
        return ApiResponse.error('Cette catégorie existe déjà');
      }

      const existingCategoryOrder = await this.categoryModel.findOne({
        order: createCategoryDto.order,
      });
      if (createCategoryDto.order > 0 && existingCategoryOrder) {
        return ApiResponse.error('Une catégorie a déjà cet ordre');
      }

      // 2. Upload de l'image vers Cloudinary (si présente)
      if (file) {
        uploadedUrl = await this.cloudinaryService.uploadBuffer(file.buffer);
      }

      // 3. Création et Sauvegarde en BDD
      const slug = this.sharedService.generateSlug(createCategoryDto.name);
      const createdCategory = new this.categoryModel({
        ...createCategoryDto,
        slug,
        image: uploadedUrl, // On stocke l'URL Cloudinary
      });

      const savedCategory = await createdCategory.save();
      return ApiResponse.success('Catégorie créée', savedCategory);
    } catch (error) {
      // 4. Nettoyage : Si la BDD échoue mais que l'image a été uploadée
      if (uploadedUrl) {
        await this.cloudinaryService.deleteByUrl(uploadedUrl);
      }

      return ApiResponse.error('Erreur lors de la création de la catégorie');
    }
  }

  async categoryByOrder() {
    try {
      const category = await this.categoryModel
        .find({}, 'name slug image order')
        .sort({ order: 1 })
        .exec();
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
    return this.categoryModel.findOne({ _id: id }, '_id');
  }

  async findCateroryBySlug(slug: string) {
    try {
      const category = await this.categoryModel.findOne(
        { slug: slug },
        'name slug image description',
      );

      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }

      const services = await this.serviceModel.find({
        category: category._id,
      });
      const serviceIds = services.map((s) => s._id);

      // Récupération avec Tri Intelligent
      const products = await this.productModel
        .find(
          { service: { $in: serviceIds } },
          'name slug priceMonth images stock is_selected order', // is_selected = top product
        )
        .sort({
          is_selected: -1, // Top products en premier
          stock: -1, // Stock disponible avant rupture
          order: 1, // Ordre manuel défini en back-office
        });

      // Optionnel : Forcer les stocks épuisés à la toute fin manuellement
      // si le tri Mongoose ne suffit pas pour ton besoin précis
      const sortedProducts = products.sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return 1;
        if (a.stock > 0 && b.stock === 0) return -1;
        return 0;
      });

      return ApiResponse.success('Catégorie et produits trouvés avec succès', {
        category,
        products: sortedProducts,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération');
    }
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

  async update(
    slug: string,
    updateCategoryDto: UpdateCategoryDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files?.newImage?.[0];
    let oldImageUrl: string | null = null;
    let newUploadedUrl: string | null = null;

    try {
      // 1. Chercher la catégorie existante
      const category = await this.categoryModel.findOne({ slug });
      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }

      // 2. Unicité du nom + régénération du slug
      if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
        const dup = await this.categoryModel.findOne({
          name: updateCategoryDto.name,
          _id: { $ne: category._id },
        });
        if (dup) {
          return ApiResponse.error('Une catégorie avec ce nom existe déjà');
        }
        (updateCategoryDto as any).slug = this.sharedService.generateSlug(
          updateCategoryDto.name,
        );
      }

      // 3. Unicité de l'ordre
      if (updateCategoryDto.order !== undefined) {
        const dupOrder = await this.categoryModel.findOne({
          order: updateCategoryDto.order,
          _id: { $ne: category._id },
        });
        if (dupOrder) {
          return ApiResponse.error('Une catégorie a déjà cet ordre');
        }
      }

      // 4. Si une nouvelle image est envoyée
      if (file) {
        newUploadedUrl = await this.cloudinaryService.uploadBuffer(file.buffer);

        // On garde précieusement l'URL de l'ancienne image pour la supprimer plus tard
        oldImageUrl = category.image;

        // On met à jour le DTO avec la nouvelle URL
        updateCategoryDto['image'] = newUploadedUrl;
      }

      // 3. Mise à jour du slug si le nom a changé
      // if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      //   updateCategoryDto['slug'] = this.sharedService.generateSlug(
      //     updateCategoryDto.name,
      //   );
      // }

      // 4. Mise à jour en BDD
      const updatedCategory = await this.categoryModel.findOneAndUpdate(
        { slug },
        updateCategoryDto,
        { new: true },
      );

      // 5. Nettoyage de l'ancienne image
      // On ne supprime l'ancienne QUE si la mise à jour BDD a réussi ET qu'une nouvelle image a été fournie
      if (file && oldImageUrl) {
        await this.cloudinaryService.deleteByUrl(oldImageUrl);
      }

      return ApiResponse.success(
        'Catégorie mise à jour avec succès',
        updatedCategory,
      );
    } catch (error) {
      // Si la BDD échoue mais qu'on avait déjà uploadé la nouvelle image, on l'annule
      if (newUploadedUrl) {
        await this.cloudinaryService.deleteByUrl(newUploadedUrl);
      }

      console.error(error);
      return ApiResponse.error('Erreur lors de la mise à jour');
    }
  }

  async remove(slug: string) {
    try {
      // 1. On récupère d'abord la catégorie pour avoir le chemin de l'image
      const category = await this.categoryModel.findOne({ slug });

      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }

      // 2. On supprime l'entrée en base de données
      await this.categoryModel.deleteOne({ slug });

      // 3. Si la catégorie avait une image, on la supprime sur Cloudinary
      if (category.image) {
        await this.cloudinaryService.deleteByUrl(category.image);
      }

      return ApiResponse.success('Catégorie supprimée avec succès');
    } catch (error) {
      console.error(error);
      return ApiResponse.error('Erreur lors de la suppression de la catégorie');
    }
  }
}
