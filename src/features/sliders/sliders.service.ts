import { Injectable } from '@nestjs/common';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { Slider } from './entities/slider.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';

@Injectable()
export class SlidersService {
  constructor(
    @InjectModel(Slider.name) private readonly sliderModel: Model<Slider>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}
  async create(
    createSliderDto: CreateSliderDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files.newImage?.[0];
    let uploadedUrl = '';

    try {
      // 1. Vérifications initiales
      const existingSlider = await this.sliderModel.findOne({
        title: createSliderDto.title,
      });
      if (existingSlider) return ApiResponse.error('Le slider existe déjà');

      const existingOrder = await this.sliderModel.findOne({
        order: createSliderDto.order,
      });
      if (existingOrder) return ApiResponse.error('Cet ordre est déjà utilisé');

      // 2. Upload de l'image vers Cloudinary
      if (file) {
        uploadedUrl = await this.cloudinaryService.uploadBuffer(file.buffer);
      }

      // 3. Création de l'instance et sauvegarde en BDD
      const newSlider = new this.sliderModel({
        ...createSliderDto,
        image: uploadedUrl, // On stocke l'URL Cloudinary
      });
      const savedSlider = await newSlider.save();

      return ApiResponse.success('Slider créé avec succès', savedSlider);
    } catch (error) {
      if (uploadedUrl) {
        await this.cloudinaryService.deleteByUrl(uploadedUrl);
      }
      return ApiResponse.error('Erreur lors de la création du slider');
    }
  }
  //Récuperation des sliders sans order 1
  async findAll() {
    try {
      const sliders = await this.sliderModel.find().sort({ order: -1 }).exec();
      return ApiResponse.success('Liste des sliders récupérée', sliders);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des sliders');
    }
  }
  // Retoune les sliders avec les orders les plus grand.
  async findTopSliders(limit: number) {
    try {
      const finalLimit = Math.max(1, Math.floor(limit));

      const topSliders = await this.sliderModel
        .find({ order: { $gt: 0 } })
        .sort({ order: 1 })
        .limit(finalLimit) // Utilise la limite dynamique
        .exec();
      return ApiResponse.success(
        `Top ${finalLimit} sliders récupérés`,
        topSliders,
      );
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération des sliders');
    }
  }
  async update(
    idSlider: string,
    updateSliderDto: UpdateSliderDto,
    files: { newImage?: Express.Multer.File[] },
  ) {
    const file = files?.newImage?.[0];
    let oldImageUrl: string | null = null;
    let newUploadedUrl: string | null = null;

    try {
      // 1. Trouver le slider actuel
      const slider = await this.sliderModel.findById(idSlider);
      if (!slider) {
        return ApiResponse.error('Slider introuvable');
      }
      // 2. GÉRER L'UNICITÉ DU TITRE
      if (
        updateSliderDto.title !== undefined &&
        updateSliderDto.title !== slider.title
      ) {
        const dupTitle = await this.sliderModel.findOne({
          title: updateSliderDto.title,
          _id: { $ne: idSlider },
        });
        if (dupTitle) {
          return ApiResponse.error('Un slider avec ce titre existe déjà');
        }
      }

      // 3. GÉRER L'UNICITÉ DE L'ORDRE
      if (updateSliderDto.order !== undefined) {
        const existingOrder = await this.sliderModel.findOne({
          order: updateSliderDto.order,
          _id: { $ne: idSlider },
        });
        if (existingOrder) {
          return ApiResponse.error(
            `L'ordre ${updateSliderDto.order} est déjà utilisé par un autre slider`,
          );
        }
      }
      // 2. Gestion de la nouvelle image (si présente)
      if (file) {
        newUploadedUrl = await this.cloudinaryService.uploadBuffer(file.buffer);

        // On mémorise l'ancienne image pour la supprimer après le succès en BDD
        oldImageUrl = slider.image;

        // Mise à jour de l'URL dans le DTO
        updateSliderDto.newImage = newUploadedUrl;
      }
      const updatedSlider = await this.sliderModel.findByIdAndUpdate(
        idSlider, // Mongoose sait qu'il s'agit de l'ID technique
        { $set: updateSliderDto },
        { new: true }, // Pour récupérer l'objet APRÈS modification
      );

      if (!updatedSlider) {
        return ApiResponse.error('Slider introuvable, mise à jour impossible.');
      }

      // La suite de votre logique pour l'image...
      if (file && oldImageUrl) {
        await this.cloudinaryService.deleteByUrl(oldImageUrl);
      }

      return ApiResponse.success(
        'Slider mis à jour avec succès',
        updatedSlider,
      );
    } catch (error) {
      if (newUploadedUrl) {
        await this.cloudinaryService.deleteByUrl(newUploadedUrl);
      }
      return ApiResponse.error('Erreur lors de la mise à jour');
    }
  }
  async remove(idSlider: string) {
    try {
      // 1. Récupérer le slider pour avoir le chemin de l'image
      const slider = await this.sliderModel.findById(idSlider);

      if (!slider) {
        return ApiResponse.error('Slider introuvable.');
      }
      await this.sliderModel.findByIdAndDelete(idSlider);
      // 2. Suppression de l'image sur Cloudinary
      if (slider.image) {
        await this.cloudinaryService.deleteByUrl(slider.image);
      }
      return ApiResponse.success('Slider supprimé avec succès.');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la suppression du slider.');
    }
  }
}
