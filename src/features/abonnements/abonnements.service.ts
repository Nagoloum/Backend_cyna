import { Injectable } from '@nestjs/common';
import { CreateAbonnementDto } from './dto/create-abonnement.dto';
import { UpdateAbonnementDto } from './dto/update-abonnement.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Abonnement } from './entities/abonnement.entity';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';

@Injectable()
export class AbonnementsService {
  constructor(
    @InjectModel(Abonnement.name) private abonnementModel: Model<Abonnement>,
  ) {}
  async create(createAbonnementDto: CreateAbonnementDto, currentUser: any) {
    try {
      const abonnement = new this.abonnementModel({
        ...createAbonnementDto,
        user: currentUser?.data?._id,
      });
      const savedAbonnement = await abonnement.save();
      return ApiResponse.success(
        'Abonnement created successfully',
        savedAbonnement,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la création de l'abonnement",
        error,
      );
    }
  }

  findAll() {
    return `This action returns all abonnements`;
  }

  findOne(id: number) {
    return `This action returns a #${id} abonnement`;
  }

  update(id: number, updateAbonnementDto: UpdateAbonnementDto) {
    return `This action updates a #${id} abonnement`;
  }

  remove(id: number) {
    return `This action removes a #${id} abonnement`;
  }
}
