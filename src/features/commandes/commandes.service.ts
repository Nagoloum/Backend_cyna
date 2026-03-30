import { Injectable } from '@nestjs/common';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Commande } from './entities/commande.entity';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { Abonnement } from '../abonnements/entities/abonnement.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { UserRoles } from 'src/shared/common/user-roles.enum';

@Injectable()
export class CommandesService {
  constructor(
    @InjectModel(Commande.name) private commandeModel: Model<Commande>,
    @InjectModel(Abonnement.name) private abonnementModel: Model<Abonnement>,
    private readonly sharedService: SharedService,
  ) {}
  async create(createCommandeDto: CreateCommandeDto, currentUser: any) {
    try {
      const commande = new this.commandeModel({
        ...createCommandeDto,
        user: currentUser?.data?._id,
        reference: this.sharedService.generateReference(),
      });
      const savedCommande = await commande.save();

      for (const abonnementDto of createCommandeDto.abonnements) {
        const abonnement = new this.abonnementModel({
          ...abonnementDto,
          user: currentUser?.data?._id,
          commande: savedCommande._id,
        });
        await abonnement.save();
      }

      return ApiResponse.success('Commande created successfully');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la création de la commande',
        error,
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
          { reference: { $regex: search, $options: 'i' } },
          { statut: { $regex: search, $options: 'i' } },
          { totalPrice: { $regex: search, $options: 'i' } },
          { nbreProducts: { $regex: search, $options: 'i' } },
        ];
      }

      const allowedSortFields = new Set([
        'reference',
        'statut',
        'totalPrice',
        'nbreProducts',
      ]);
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
        this.commandeModel
          .find(whereQuery)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.commandeModel.countDocuments(whereQuery).exec(),
      ]);

      return ApiResponse.success('Liste des commandes récupérées', {
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

  async findOne(reference: string, currentUser: any) {
    try {
      const commande = await this.commandeModel
        .findOne({ reference: reference })
        .populate('user', 'name email')
        .populate('cb', 'cardNumber')
        .exec();
      if (!commande) {
        return ApiResponse.error('Commande non trouvée');
      }
      const abonnements = await this.abonnementModel
        .find({ commande: commande?._id })
        .populate('product')
        .exec();
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner =
        commande?.user?._id.toString() === currentUser?.data?._id.toString();

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette commande",
        );
      }
      return ApiResponse.success('Commande récupérée', {
        ...commande.toObject(),
        abonnements,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la récupération de la commande');
    }
  }

  update(id: number, updateCommandeDto: UpdateCommandeDto) {
    return `This action updates a #${id} commande`;
  }

  remove(id: number) {
    return `This action removes a #${id} commande`;
  }
}
