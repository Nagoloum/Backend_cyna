import { Injectable } from '@nestjs/common';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { Slider } from './entities/slider.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { SlidersModule } from './sliders.module';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SlidersService {
  constructor(
    @InjectModel(Slider.name) private readonly sliderModel: Model<Slider>,
  ) { }
async create(
  createSliderDto: CreateSliderDto,
  files: { newImage?: Express.Multer.File[] }
) {
  const file = files.newImage?.[0];
  let fullPath = '';
  let relativePath = '';

  try {
    // 1. Vérifications initiales
    const existingSlider = await this.sliderModel.findOne({ title: createSliderDto.title });
    if (existingSlider) return ApiResponse.error('Le slider existe déjà');

    const existingOrder = await this.sliderModel.findOne({ order: createSliderDto.order });
    if (existingOrder) return ApiResponse.error('Cet ordre est déjà utilisé');

    // 2. Gestion du fichier image
    if (file) {
      const uploadDir = './storage/sliders';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `slider-${uniqueSuffix}${path.extname(file.originalname)}`;
      
      fullPath = path.join(uploadDir, fileName);
      relativePath = `storage/sliders/${fileName}`;

      fs.writeFileSync(fullPath, file.buffer);
    }

    // 3. Création de l'instance et sauvegarde en BDD
    const newSlider = new this.sliderModel({
      ...createSliderDto,
      image: relativePath, // On stocke le chemin relatif
    });

    const savedSlider = await newSlider.save();

    return ApiResponse.success('Slider créé avec succès', savedSlider);

  } catch (error) {
    if (fullPath && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return ApiResponse.error('Erreur lors de la création du slider');
  }
}
  //Récuperation des sliders sans order 1
  async findAll() {
    try {
      const sliders = await this.sliderModel.find().sort({ order: -1 }).exec();
      return ApiResponse.success("Liste des sliders récupérée", sliders);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des sliders');
    }
  }
  // Retoune les sliders avec les orders les plus grand.
  async findTopSliders(limit: number = 3) {
    try {
      const finalLimit = Math.max(1, Math.floor(limit));
      const topSliders = await this.sliderModel
        .find()
        .sort({ order: -1 }) // Trie du plus grand au plus petit
        .limit(finalLimit)   // Utilise la limite dynamique
        .exec();
      return ApiResponse.success(`Top ${finalLimit} sliders récupérés`, topSliders);
    }
    catch (error) {
      return ApiResponse.error("Erreur lors de la récupération des sliders");
    }
  }
  async update(
    slug: string,
    updateSliderDto: UpdateSliderDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files?.newImage?.[0];
    let oldImagePath: string | null = null;
    let newRelativePath: string | null = null;

    try {
      // 1. Trouver le slider actuel
      const slider = await this.sliderModel.findOne({ slug });
      if (!slider) {
        return ApiResponse.error('Slider introuvable');
      }
      // 2. Gestion de la nouvelle image (si présente)
      if (file) {
        const uploadDir = './storage/sliders';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `slider-${uniqueSuffix}${path.extname(file.originalname)}`;

        newRelativePath = `storage/sliders/${fileName}`;
        const fullPath = path.join(uploadDir, fileName);
        // Écriture du fichier
        fs.writeFileSync(fullPath, file.buffer);

        // On mémorise l'ancienne image pour la supprimer après le succès en BDD
        oldImagePath = slider.image;

        // Mise à jour du chemin dans le DTO
        updateSliderDto.image = newRelativePath;
      }
      const updatedSlider = await this.sliderModel.findOneAndUpdate(
        { slug },
        { $set: updateSliderDto },
        { new: true },
      );
      if (file && oldImagePath) {
        const oldFullRootPath = path.join(process.cwd(), oldImagePath);
        if (fs.existsSync(oldFullRootPath)) {
          fs.unlinkSync(oldFullRootPath);
        }
      }
      return ApiResponse.success(
        'Slider mis à jour avec succès',
        updatedSlider
      );

    } catch (error) {
      if (newRelativePath) {
        const tempPath = path.join(process.cwd(), newRelativePath);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
      return ApiResponse.error('Erreur lors de la mise à jour');
    }
  }
  async remove(slug: string) {
    try {
      const slider = await this.sliderModel.findOne({ slug });
      if (!slider) {
        return ApiResponse.error('Slider introuvable.');
      }

      // 2. Suppression du fichier physique
      if (slider.image) {
        const fullPath = path.join(process.cwd(), slider.image);

        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (fileError) {
            return ApiResponse.error(
              'Une erreur est survenue lors de la suppression de l’image', fileError
            );
          }
        }
      }

      // 3. Suppression en base de données
      const result = await this.sliderModel.deleteOne({ slug: slug });
      return ApiResponse.success('Slider supprimé avec succès.');
    }
    catch (error) {
      console.error(error);
      return ApiResponse.error('Erreur lors de la suppression du slider.');
    }
  }
}
