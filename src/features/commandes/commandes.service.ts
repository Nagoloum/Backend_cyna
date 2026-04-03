import { Injectable } from '@nestjs/common';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Commande } from './entities/commande.entity';
import { Model, Types } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { UserRoles } from 'src/shared/common/user-roles.enum';

@Injectable()
export class CommandesService {
  constructor(
    @InjectModel(Commande.name) private commandeModel: Model<Commande>,
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

  // async findAllByUser(queryDto: QueryDto, currentUser: any) {
  //   try {
  //     const userId = currentUser?.data?._id;
  //
  //     if (!userId) {
  //       return ApiResponse.error('Utilisateur non authentifié');
  //     }
  //
  //     const {
  //       page = 1,
  //       limit = 10,
  //       search,
  //       year,
  //       serviceType,
  //       status,
  //       sortOrder,
  //     } = queryDto;
  //
  //     const whereQuery: any = {
  //       user: new Types.ObjectId(userId),
  //     };
  //
  //     if (year) {
  //       const startOfYear = new Date(year, 0, 1);
  //       const endOfYear = new Date(year + 1, 0, 1);
  //
  //       whereQuery._id = {
  //         $gte: Types.ObjectId.createFromTime(
  //           Math.floor(startOfYear.getTime() / 1000),
  //         ),
  //         $lt: Types.ObjectId.createFromTime(
  //           Math.floor(endOfYear.getTime() / 1000),
  //         ),
  //       };
  //     }
  //
  //     const selectedSortOrder: 1 | -1 =
  //       typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc'
  //         ? 1
  //         : -1;
  //
  //     const commandes = await this.commandeModel
  //       .find(whereQuery)
  //       .sort({ _id: selectedSortOrder })
  //       .lean()
  //       .exec();
  //
  //     if (!commandes.length) {
  //       return ApiResponse.success('Liste des commandes récupérées', {
  //         data: [],
  //         groupedByYear: [],
  //         total: 0,
  //         page,
  //         limit,
  //         totalPage: 0,
  //       });
  //     }
  //
  //     const abonnements = await this.abonnementModel
  //       .find({
  //         commande: {
  //           $in: commandes.map((commande) => commande._id),
  //         },
  //       })
  //       .populate({
  //         path: 'product',
  //         select: 'name slug service',
  //         populate: {
  //           path: 'service',
  //           select: 'name slug',
  //         },
  //       })
  //       .lean()
  //       .exec();
  //
  //     const abonnementsByCommande = new Map<string, any[]>();
  //
  //     for (const abonnement of abonnements) {
  //       const commandeId = abonnement.commande?._id.toString();
  //       if (!commandeId) {
  //         continue;
  //       }
  //
  //       const existingAbonnements = abonnementsByCommande.get(commandeId) ?? [];
  //       existingAbonnements.push(abonnement);
  //       abonnementsByCommande.set(commandeId, existingAbonnements);
  //     }
  //
  //     const normalizedSearch = search?.trim().toLowerCase();
  //     const normalizedServiceType = serviceType?.trim().toLowerCase();
  //     const normalizedStatus = status?.trim().toLowerCase();
  //
  //     const filteredCommandes = commandes
  //       .map((commande) => {
  //         const commandeDate = this.getCommandeDate(commande);
  //         const commandeYear = commandeDate.getFullYear();
  //
  //         const relatedAbonnements =
  //           abonnementsByCommande.get(commande._id.toString()) ?? [];
  //
  //         const filteredAbonnements = relatedAbonnements.filter(
  //           (abonnement) => {
  //             const productName =
  //               abonnement?.product?.name?.toLowerCase?.() ?? '';
  //             const serviceName =
  //               abonnement?.product?.service?.name?.toLowerCase?.() ?? '';
  //             const abonnementStatus =
  //               abonnement?.statut?.toString()?.toLowerCase?.() ?? '';
  //
  //             const matchesServiceType = normalizedServiceType
  //               ? productName.includes(normalizedServiceType) ||
  //                 serviceName.includes(normalizedServiceType)
  //               : true;
  //
  //             const matchesStatus = normalizedStatus
  //               ? abonnementStatus === normalizedStatus
  //               : true;
  //
  //             return matchesServiceType && matchesStatus;
  //           },
  //         );
  //
  //         const searchableValues = [
  //           commande.reference,
  //           commande.statut,
  //           commande.totalPrice?.toString(),
  //           commande.nbreProducts?.toString(),
  //           commandeDate.toLocaleDateString('fr-FR'),
  //           commandeDate.toISOString().slice(0, 10),
  //           ...filteredAbonnements.flatMap((abonnement) => [
  //             abonnement?.product?.name,
  //             abonnement?.product?.service?.name,
  //           ]),
  //         ]
  //           .filter(Boolean)
  //           .map((value) => value.toString().toLowerCase());
  //
  //         const matchesSearch = normalizedSearch
  //           ? searchableValues.some((value) => value.includes(normalizedSearch))
  //           : true;
  //
  //         return {
  //           ...commande,
  //           createdAt: commandeDate,
  //           year: commandeYear,
  //           abonnements: filteredAbonnements,
  //           matchesSearch,
  //         };
  //       })
  //       .filter(
  //         (commande) =>
  //           commande.abonnements.length > 0 &&
  //           commande.matchesSearch &&
  //           (!year || commande.year === year),
  //       )
  //       .sort((a, b) =>
  //         selectedSortOrder === 1
  //           ? a.createdAt.getTime() - b.createdAt.getTime()
  //           : b.createdAt.getTime() - a.createdAt.getTime(),
  //       );
  //
  //     const total = filteredCommandes.length;
  //     const totalPage = total > 0 ? Math.ceil(total / limit) : 0;
  //     const skip = (page - 1) * limit;
  //     const paginatedCommandes = filteredCommandes.slice(skip, skip + limit);
  //
  //     const groupedByYear = Array.from(
  //       paginatedCommandes.reduce((accumulator, commande) => {
  //         const yearKey = commande.year;
  //         const currentGroup = accumulator.get(yearKey) ?? [];
  //         currentGroup.push(commande);
  //         accumulator.set(yearKey, currentGroup);
  //         return accumulator;
  //       }, new Map<number, any[]>()),
  //     )
  //       .sort(([firstYear], [secondYear]) =>
  //         selectedSortOrder === 1
  //           ? firstYear - secondYear
  //           : secondYear - firstYear,
  //       )
  //       .map(([groupYear, commandesForYear]) => ({
  //         year: groupYear,
  //         commandes: commandesForYear,
  //       }));
  //
  //     return ApiResponse.success('Liste des commandes utilisateur récupérées', {
  //       data: paginatedCommandes,
  //       groupedByYear,
  //       total,
  //       page,
  //       limit,
  //       totalPage,
  //     });
  //   } catch (error) {
  //     return ApiResponse.error(
  //       'Erreur lors de la récupération des commandes utilisateur',
  //       error,
  //     );
  //   }
  // }

  private getCommandeDate(commande: any): Date {
    if (commande?.createdAt) {
      return new Date(commande.createdAt);
    }

    if (commande?._id) {
      return new Types.ObjectId(commande._id).getTimestamp();
    }

    return new Date();
  }

  // async findOne(reference: string, currentUser: any) {
  //   try {
  //     const commande = await this.commandeModel
  //       .findOne({ reference: reference })
  //       .populate('user', 'name email')
  //       .populate('cb', 'cardNumber')
  //       .exec();
  //     if (!commande) {
  //       return ApiResponse.error('Commande non trouvée');
  //     }
  //     const abonnements = await this.abonnementModel
  //       .find({ commande: commande?._id })
  //       .populate('product')
  //       .exec();
  //     // --- 2) Autorisations ---
  //     const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
  //     const isOwner =
  //       commande?.user?._id.toString() === currentUser?.data?._id.toString();
  //
  //     if (!isOwner && !isAdmin) {
  //       return ApiResponse.error(
  //         "Vous n'êtes pas propriétaire de cette commande",
  //       );
  //     }
  //     return ApiResponse.success('Commande récupérée', {
  //       ...commande.toObject(),
  //       abonnements,
  //     });
  //   } catch (error) {
  //     return ApiResponse.error('Erreur lors de la récupération de la commande');
  //   }
  // }

  update(id: number, updateCommandeDto: UpdateCommandeDto) {
    return `This action updates a #${id} commande`;
  }

  remove(id: number) {
    return `This action removes a #${id} commande`;
  }

  findOne(reference: string, currentUser: any) {}

  findAllByUser(queryDto: QueryDto, currentUser: any) {}
}
