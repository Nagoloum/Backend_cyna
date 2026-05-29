import { Injectable } from '@nestjs/common';
import { CreateAdresseFacturationDto } from './dto/create-adresse_facturation.dto';
import { UpdateAdresseFacturationDto } from './dto/update-adresse_facturation.dto';
import { ApiResponse } from 'src/shared/responses/api-response';
import { InjectModel } from '@nestjs/mongoose';
import { AdresseFacturation } from './entities/adresse_facturation.entity';
import { isValidObjectId, Model, Types } from 'mongoose';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { QueryDto } from 'src/shared/dto/query.dto';

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
        "Erreur lors de la création de l'adresse de facturation ",
      );
    }
  }
  async cbDefault(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      await this.adresseModel.updateMany(
        { user: currentUser?.data?._id, _id: { $ne: new Types.ObjectId(id) } },
        { $set: { isDefault: false } },
      );
      const adresseFacturation = await this.adresseModel.updateOne(
        {
          _id: new Types.ObjectId(id),
          user: currentUser?.data?._id,
        },
        { $set: { isDefault: true } },
      );

      if (adresseFacturation.matchedCount === 0) {
        return ApiResponse.error(
          'Adresse de facturation par défaut non trouvée',
        );
      }

      return ApiResponse.success(
        'Adresse de facturation mise par défaut avec succès',
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la récupération de l'adresse de facturation par défaut",
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
          { adresse: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
          { codePostal: { $regex: search, $options: 'i' } },
          { region: { $regex: search, $options: 'i' } },
        ];
      }

      const allowedSortFields = new Set([
        'adresse',
        'city',
        'codePostal',
        'region',
      ]);
      const selectedSortField =
        sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
      const selectedSortOrder: 1 | -1 =
        typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc'
          ? 1
          : -1;
      const sortQuery: Record<string, 1 | -1> = {
        [selectedSortField]: selectedSortOrder,
        adresse: 1,
      };

      const [data, total] = await Promise.all([
        this.adresseModel
          .find(whereQuery)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.adresseModel.countDocuments(whereQuery).exec(),
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

  async findByUser(currentUser: any) {
    try {
      const adresseFacturations = await this.adresseModel
        .find(
          {
            user: currentUser?.data?._id,
          },
          '-user',
        )
        .sort({ isDefault: -1, createdAt: -1 });
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

  async findOne(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const adresseFacturation = await this.adresseModel.findById(id);

      if (!adresseFacturation) {
        return ApiResponse.error('Adresse de facturation non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = adresseFacturation?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette adresse de facturation",
        );
      }
      return ApiResponse.success(
        'Adresse de facturation recuperee avec success',
        adresseFacturation,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la recupération de l'adresse de facturation",
      );
    }
  }

  async update(
    id: string,
    updateAdresseFacturationDto: UpdateAdresseFacturationDto,
    currentUser: any,
  ) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const adresseFacturation = await this.adresseModel.findById(
        id,
        '_id user',
      );

      if (!adresseFacturation) {
        return ApiResponse.error('Adresse de facturation non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = adresseFacturation?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette adresse de facturation",
        );
      }

      return ApiResponse.success(
        'Adresse de facturation mise a jour avec success',
        await this.adresseModel.findByIdAndUpdate(id, {
          $set: updateAdresseFacturationDto,
        }),
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la mise à jour de l'adresse de facturation",
      );
    }
  }

  async remove(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const adresseFacturation = await this.adresseModel.findById(
        id,
        '_id user',
      );

      if (!adresseFacturation) {
        return ApiResponse.error('Adresse de facturation non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = adresseFacturation?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette adresse de facturation",
        );
      }
      await this.adresseModel.findByIdAndDelete(id);

      return ApiResponse.success(
        'Adresse de facturation supprimee avec success',
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la suppression de l'adresse de facturation",
      );
    }
  }
}
