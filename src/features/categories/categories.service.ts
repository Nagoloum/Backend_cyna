import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from './entities/category.entity';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';
import * as fs from 'fs';
import * as path from 'path';
import { Product } from '../products/entities/product.entity';
import { Service } from '../services/entities/service.entity';
@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,

    private readonly sharedService: SharedService,
  ) {}
  async create(
    createCategoryDto: CreateCategoryDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files.newImage?.[0];
    let fullPath = '';
    let relativePath = '';

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
      if (existingCategoryOrder) {
        return ApiResponse.error('Une catégorie a déjà cet ordre');
      }

      // 2. Gestion du fichier (si présent)
      if (file) {
        const uploadDir = './storage/categories';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `cat-${uniqueSuffix}${path.extname(file.originalname)}`;

        fullPath = path.join(uploadDir, fileName);
        relativePath = `storage/categories/${fileName}`;

        // Écriture physique du fichier
        fs.writeFileSync(fullPath, file.buffer);
      }

      // 3. Création et Sauvegarde en BDD
      const slug = this.sharedService.generateSlug(createCategoryDto.name);
      const createdCategory = new this.categoryModel({
        ...createCategoryDto,
        slug,
        image: relativePath, // On stocke le chemin relatif
      });

      const savedCategory = await createdCategory.save();
      return ApiResponse.success('Catégorie créée', savedCategory);
    } catch (error) {
      // 4. Nettoyage : Si la BDD échoue mais que le fichier a été écrit
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
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
    return await this.categoryModel.findOne({ _id: id }, '_id');
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
          'name slug priceMonth images stock priority order', // On ajoute stock et priority pour le front
        )
        .sort({
          priority: -1, // Prioritaires en premier (true > false)
          stock: -1, // Stock disponible avant rupture (si stock > 0)
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
    let oldImagePath: string | null = null;
    let newRelativePath: string | null = null;

    try {
      // 1. Chercher la catégorie existante
      const category = await this.categoryModel.findOne({ slug });
      if (!category) {
        return ApiResponse.error('Catégorie non trouvée');
      }

      // 2. Si une nouvelle image est envoyée
      if (file) {
        const uploadDir = './storage/categories';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `cat-${uniqueSuffix}${path.extname(file.originalname)}`;

        newRelativePath = `storage/categories/${fileName}`;
        const fullPath = path.join(uploadDir, fileName);

        // Écriture de la nouvelle image
        fs.writeFileSync(fullPath, file.buffer);

        // On garde précieusement le chemin de l'ancienne image pour la supprimer plus tard
        oldImagePath = category.image;

        // On met à jour le DTO avec le nouveau chemin
        updateCategoryDto['image'] = newRelativePath;
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
      if (file && oldImagePath) {
        const oldFullRootPath = path.join(process.cwd(), oldImagePath);
        if (fs.existsSync(oldFullRootPath)) {
          fs.unlinkSync(oldFullRootPath);
        }
      }

      return ApiResponse.success(
        'Catégorie mise à jour avec succès',
        updatedCategory,
      );
    } catch (error) {
      // Si la BDD échoue mais qu'on avait déjà écrit la nouvelle image, on l'annule
      if (newRelativePath) {
        const tempPath = path.join(process.cwd(), newRelativePath);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
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

      // 3. Si la catégorie avait une image, on la supprime du disque
      if (category.image) {
        const fullPath = path.join(process.cwd(), category.image);

        // On vérifie si le fichier existe avant de tenter de le supprimer
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (fileError) {
            return ApiResponse.error(
              'Une erreur est survenue lors de la suppression de l’image',
            );
          }
        }
      }

      return ApiResponse.success('Catégorie supprimée avec succès');
    } catch (error) {
      console.error(error);
      return ApiResponse.error('Erreur lors de la suppression de la catégorie');
    }
  }
}
