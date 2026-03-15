import { Injectable } from '@nestjs/common';
import { CreateAdresseFacturationDto } from './dto/create-adresse_facturation.dto';
import { UpdateAdresseFacturationDto } from './dto/update-adresse_facturation.dto';
import { ApiResponse } from 'src/shared/responses/api-response';
import { InjectModel } from '@nestjs/mongoose';
import { AdresseFacturation } from './entities/adresse_facturation.entity';
import { Model } from 'mongoose';

@Injectable()
export class AdresseFacturationsService {
  constructor(
    @InjectModel(AdresseFacturation.name)
    private adresseModel: Model<AdresseFacturation>,
  ) {}
  async create(
    createAdresseFacturationDto: CreateAdresseFacturationDto,
    currentUser: any,
  ) {
    try {
      const exist = await this.adresseModel.exists({
        adresse: createAdresseFacturationDto.adresse,
        user: currentUser?.data?._id,
      });

      if (exist) {
        return ApiResponse.error('Cette adresse de facturation existe deja');
      }

      const createAdresseFacturation = await this.adresseModel.create({
        ...createAdresseFacturationDto,
        user: currentUser?.data?._id,
      });
      const savedAdresseFacturation = await createAdresseFacturation.save();
      return ApiResponse.success(
        'Adresse de facturation crée avec success',
        savedAdresseFacturation,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la création de l'adresse de facturation",
      );
    }
  }

  async findByUser(currentUser: any) {
    try {
      const adresseFacturations = await this.adresseModel.find({
        user: currentUser?.data?._id,
      });
      return ApiResponse.success(
        'Adresse de facturation recuperee avec success',
        adresseFacturations,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la recupération de l'adresse de facturation de l'utilisateur",
      );
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} adresseFacturation`;
  }

  update(id: number, updateAdresseFacturationDto: UpdateAdresseFacturationDto) {
    return `This action updates a #${id} adresseFacturation`;
  }

  remove(id: number) {
    return `This action removes a #${id} adresseFacturation`;
  }
}
