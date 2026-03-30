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
import * as fs from 'fs';
import * as path from 'path';
import { ImageDto } from 'src/shared/dto';
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly sharedService: SharedService,
    private readonly servicesService: ServicesService,
  ) {}
  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    const savedFiles: string[] = []; // Pour garder trace en cas d'erreur (rollback)

    try {
      // 1. Vérification d'existence
      const existingProduct = await this.productModel.exists({
        name: createProductDto.name,
      });
      if (existingProduct) {
        return ApiResponse.error('Un produit avec ce nom existe déjà');
      }

      // 2. Résolution du Service
      const serviceId = await resolveIdOrThrow(
        createProductDto.serviceId,
        (id) => this.servicesService.findOneById(id),
        'Service',
      );

      // 3. Stockage des images physiques
      const uploadDir = './storage/products';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const imageObjects: ImageDto[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileName = `prod-${uniqueSuffix}${path.extname(file.originalname)}`;
          const fullPath = path.join(uploadDir, fileName);
          const relativePath = `storage/products/${fileName}`;

          // Écriture disque
          fs.writeFileSync(fullPath, file.buffer);
          savedFiles.push(fullPath); // On mémorise le chemin absolu pour le rollback

          // On prépare l'objet pour le tableau 'images' du DTO/Schema
          imageObjects.push({
            url: relativePath,
          });
        }
      }

      // 4. Création en BDD
      const slug = this.sharedService.generateSlug(createProductDto.name);
      const createdProduct = new this.productModel({
        ...createProductDto,
        slug,
        service: serviceId,
        images: imageObjects, // On remplace le champ images par nos nouveaux objets
      });

      const savedProduct = await createdProduct.save();
      return ApiResponse.success('Produit créé avec succès', savedProduct);
    } catch (error) {
      // ROLLBACK : On supprime toutes les images si une erreur survient
      for (const fullPath of savedFiles) {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      console.error(error);
      return ApiResponse.error('Erreur lors de la création du produit');
    }
  }

  async productByOrder() {
    try {
      const product = await this.productModel
        .find(
          {
            priority: true,
          },
          'name slug image order',
        )
        .sort({ order: 1 })
        .exec();
      if (!product) {
        return ApiResponse.error('Produit non trouvée');
      }
      return ApiResponse.success('Produit récupérée avec succès', product);
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la récupération des produits par ordre',
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

  async findOne(slug: string) {
    try {
      const product = await this.productModel
        .findOne({ slug: slug })
        .populate('service', 'name slug')
        .exec();
      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }
      return ApiResponse.success('Produit récupéré avec succès', product);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération du produit');
    }
  }

  async findBySlug(slug: string) {
    try {
      const product = await this.productModel
        .findOne({ slug: slug })
        .populate('service', '_id')
        .exec();

      // produit similaire qui ont le même serviceId
      const similarProducts = await this.productModel
        .find({
          slug: { $ne: slug }, // Exclure le produit actuel
          service: product?.service._id, // Même serviceId
        })
        .select('name slug images') // Champs à retourner
        .exec();

      // Ajouter les produits similaires à la réponse
      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }
      return ApiResponse.success('Produit récupéré avec succès', {
        ...product.toObject(),
        similarProducts,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération du produit');
    }
  }

  async update(
    slug: string,
    updateProductDto: UpdateProductDto,
    files: Express.Multer.File[],
  ) {
    const newSavedFiles: string[] = []; // Pour rollback en cas d'erreur

    try {
      // 1. Récupérer le produit existant
      const existingProduct = await this.productModel.findOne({ slug });
      if (!existingProduct) {
        return ApiResponse.error('Produit non trouvé');
      }

      // 2. Préparer les nouvelles images
      let finalImages: ImageDto[] = [];

      // Si l'utilisateur a envoyé de NOUVELLES images
      if (files && files.length > 0) {
        const uploadDir = './storage/products';
        if (!fs.existsSync(uploadDir))
          fs.mkdirSync(uploadDir, { recursive: true });

        // a. Supprimer les ANCIENNES images du disque
        if (existingProduct.images && existingProduct.images.length > 0) {
          for (const oldImg of existingProduct.images) {
            const oldPath = path.join(process.cwd(), oldImg.url);
            if (fs.existsSync(oldPath)) {
              try {
                fs.unlinkSync(oldPath);
              } catch (e) {
                console.error(
                  `Impossible de supprimer l'ancienne image: ${oldPath}`,
                );
              }
            }
          }
        }

        // b. Enregistrer les NOUVELLES images
        const newImageObjects: ImageDto[] = [];
        for (const file of files) {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileName = `prod-${uniqueSuffix}${path.extname(file.originalname)}`;
          const fullPath = path.join(uploadDir, fileName);
          const relativePath = `storage/products/${fileName}`;

          fs.writeFileSync(fullPath, file.buffer);
          newSavedFiles.push(fullPath);

          newImageObjects.push({
            url: relativePath,
          });
        }

        // On remplace totalement le tableau
        finalImages = newImageObjects;
      }

      // 3. Résolution du ServiceId et du Slug (comme avant)
      const serviceId = await resolveIdOrThrow(
        updateProductDto.serviceId,
        (id) => this.servicesService.findOneById(id),
        'Service',
      );

      const newSlug = updateProductDto.name
        ? this.sharedService.generateSlug(updateProductDto.name)
        : existingProduct.slug;

      // 4. Mise à jour finale
      const updatedProduct = await this.productModel.findOneAndUpdate(
        { slug },
        {
          ...updateProductDto,
          slug: newSlug,
          service: serviceId,
          images: finalImages, // Nouveau tableau d'images
        },
        { new: true },
      );

      return ApiResponse.success(
        'Produit mis à jour avec succès',
        updatedProduct,
      );
    } catch (error) {
      // ROLLBACK : On supprime les nouvelles images si la BDD échoue
      for (const fullPath of newSavedFiles) {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      console.error(error);
      return ApiResponse.error('Erreur lors de la mise à jour du produit');
    }
  }
  async remove(slug: string) {
    try {
      // 1. Suppression en BDD (findOneAndDelete retourne l'objet supprimé)
      const product = await this.productModel.findOneAndDelete({ slug });

      if (!product) {
        return ApiResponse.error('Produit non trouvé');
      }

      // 2. Nettoyage des images sur le disque
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          // Utilisation de path.resolve pour garantir un chemin absolu correct
          const filePath = path.resolve(process.cwd(), img.url);

          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (fileError) {
              // On log l'erreur mais on ne bloque pas la réponse client
              // car le produit est déjà supprimé en base de données.
              console.error(
                `Erreur lors de la suppression physique : ${filePath}`,
                fileError,
              );
            }
          }
        }
      }

      return ApiResponse.success('Produit et ses images supprimés avec succès');
    } catch (error) {
      console.error(error);
      return ApiResponse.error('Erreur lors de la suppression du produit');
    }
  }
}
