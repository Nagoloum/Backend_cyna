import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { Commande } from './entities/commande.entity';
import { ApiResponse } from 'src/shared/responses/api-response';
import { QueryDto } from 'src/shared/dto/query.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { Product } from '../products/entities/product.entity';
import { CarteBancaire } from '../carte_bancaires/entities/carte_bancaire.entity';
import { PeriodeAbonnement } from 'src/shared/common/periode-abonnement.enum';
import { StatutAbonnement } from 'src/shared/common/statut-abonnement.enum';
import { StatutCommande } from 'src/shared/common/statut-commande.enum';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { resolveIdOrThrow } from 'src/shared/generic/resolveId';
import { ProductsService } from '../products/products.service';
import { StripeService } from 'src/shared/services/stripe.service';

type BuiltAbonnement = {
  dateDebut: string;
  dateFin: string;
  quantity: number;
  periode: PeriodeAbonnement;
  price: number;
  statut: StatutAbonnement;
  product: Types.ObjectId;
};

@Injectable()
export class CommandesService {
  constructor(
    @InjectModel(Commande.name) private readonly commandeModel: Model<Commande>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(CarteBancaire.name)
    private readonly carteBancaireModel: Model<CarteBancaire>,
    private readonly sharedService: SharedService,
    private readonly productService: ProductsService,
    private readonly stripeService: StripeService,
  ) {}

  async create(createCommandeDto: CreateCommandeDto, currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      const carteBancaire = await this.carteBancaireModel.findById(
        createCommandeDto.cbId,
        '_id user',
      );

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire introuvable');
      }

      if (!carteBancaire.user?.equals(userId)) {
        return ApiResponse.error(
          'Vous ne pouvez pas utiliser cette carte bancaire',
        );
      }

      const builtAbonnements: BuiltAbonnement[] = [];
      let totalPrice = 0;
      let nbreProducts = 0;

      for (const abonnementDto of createCommandeDto.abonnements) {
        const ProductIdAsObjectId = await resolveIdOrThrow(
          abonnementDto.productId,
          (id) => this.productService.findOneById(id),
          'Produit',
        );
        const product = await this.productModel.findById(
          ProductIdAsObjectId,
          '_id name priceMonth priceYear',
        );

        if (!product) {
          return ApiResponse.error(
            `Produit introuvable: ${abonnementDto.productId}`,
          );
        }

        const quantity = Number(abonnementDto.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return ApiResponse.error(
            `La quantite du produit ${product.name} doit etre superieure a 0`,
          );
        }

        const unitPrice =
          abonnementDto.periode === PeriodeAbonnement.ANNUEL
            ? Number(product.priceYear ?? 0)
            : Number(product.priceMonth ?? 0);

        const dateDebut = this.normalizeStartDate(abonnementDto.dateDebut);
        const dateFin = this.computeEndDate(dateDebut, abonnementDto.periode);
        const linePrice = unitPrice * quantity;

        totalPrice += linePrice;
        nbreProducts += quantity;

        builtAbonnements.push({
          dateDebut: dateDebut.toISOString(),
          dateFin: dateFin.toISOString(),
          quantity,
          periode: abonnementDto.periode,
          price: linePrice,
          statut: StatutAbonnement.PENDING,
          product: product._id,
        });
      }

      const commande = new this.commandeModel({
        reference: this.sharedService.generateReference(),
        totalPrice,
        nbreProducts,
        statut: StatutCommande.PENDING,
        cb: new Types.ObjectId(createCommandeDto.cbId),
        user: new Types.ObjectId(userId),
        abonnements: builtAbonnements,
      });
      const savedCommande = await commande.save();

      const populatedCommande = await this.commandeModel
        .findById(savedCommande._id)
        .populate('user', 'firstName lastName email')
        .populate('cb', 'carteName carteNumber carteDate')
        .populate('abonnements.product', 'name slug priceMonth priceYear')
        .exec();

      return ApiResponse.success(
        'Commande creee avec succes',
        populatedCommande,
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la creation de la commande',
        error,
      );
    }
  }

  async createWithStripeCheckout(
    createCommandeDto: CreateCommandeDto,
    currentUser: any,
  ) {
    try {
      const createdOrderResponse = await this.create(
        createCommandeDto,
        currentUser,
      );

      if (!createdOrderResponse.success || !createdOrderResponse.data) {
        return createdOrderResponse;
      }

      const commande = createdOrderResponse.data as Commande;
      const lineItems = await this.buildStripeLineItems(createCommandeDto);
      const orderId =
        this.extractId(commande._id) ?? commande?._id?.toString?.();

      if (!orderId) {
        return ApiResponse.error(
          "Impossible de recuperer l'identifiant de la commande",
        );
      }

      const session = await this.stripeService.createCheckoutSession(
        lineItems,
        orderId,
      );

      return ApiResponse.success('Session Stripe creee avec succes', {
        commande,
        url: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la creation de la session Stripe : ' + error.message,
      );
    }
  }

  async findAll(queryDto: QueryDto) {
    try {
      const { page = 1, limit = 10, search, sortBy, sortOrder } = queryDto;
      const skip = (page - 1) * limit;

      const whereQuery: Record<string, any> = {};

      if (search) {
        whereQuery.$or = [
          { reference: { $regex: search, $options: 'i' } },
          { statut: { $regex: search, $options: 'i' } },
          { totalPrice: Number(search) || -1 },
          { nbreProducts: Number(search) || -1 },
        ];
      }

      const allowedSortFields = new Set([
        'reference',
        'statut',
        'totalPrice',
        'nbreProducts',
        'createdAt',
      ]);
      const selectedSortField =
        sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
      const selectedSortOrder: 1 | -1 =
        typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc'
          ? 1
          : -1;

      const [data, total] = await Promise.all([
        this.commandeModel
          .find(whereQuery)
          .populate('user', 'firstName lastName email')
          .populate('cb', 'carteName carteNumber carteDate')
          .populate('abonnements.product', 'name slug priceMonth priceYear')
          .sort({ [selectedSortField]: selectedSortOrder })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.commandeModel.countDocuments(whereQuery).exec(),
      ]);

      return ApiResponse.success('Liste des commandes recuperee', {
        data,
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la recuperation des commandes');
    }
  }

  async findAllByUser(queryDto: QueryDto, currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifie');
      }

      const { page = 1, limit = 10, sortOrder } = queryDto;
      const skip = (page - 1) * limit;
      const selectedSortOrder: 1 | -1 =
        typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'asc'
          ? 1
          : -1;

      const whereQuery = {
        user: new Types.ObjectId(userId),
      };

      const [data, total] = await Promise.all([
        this.commandeModel
          .find(whereQuery)
          .populate('cb', 'carteName carteNumber carteDate')
          .populate('abonnements.product', 'name slug priceMonth priceYear')
          .sort({ createdAt: selectedSortOrder })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.commandeModel.countDocuments(whereQuery).exec(),
      ]);

      return ApiResponse.success('Liste des commandes utilisateur recuperee', {
        data,
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la recuperation des commandes utilisateur',
      );
    }
  }

  async findOne(reference: string, currentUser: any) {
    try {
      const commande = await this.commandeModel
        .findOne({ reference })
        .populate('user', 'firstName lastName email role')
        .populate('cb', 'carteName carteNumber carteDate')
        .populate('abonnements.product', 'name slug priceMonth priceYear')
        .exec();

      if (!commande) {
        return ApiResponse.error('Commande non trouvee');
      }

      const isAdmin = currentUser?.data?.role === UserRoles.ADMIN;
      const ownerId = this.extractId(commande.user);
      const isOwner = ownerId === currentUser?.data?._id;

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'etes pas proprietaire de cette commande",
        );
      }

      return ApiResponse.success('Commande recuperee avec succes', commande);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la recuperation de la commande');
    }
  }

  async markAsPaid(orderId: string) {
    try {
      if (!isValidObjectId(orderId)) {
        return ApiResponse.error("L'id de la commande est invalide");
      }

      const updatedCommande = await this.commandeModel
        .findByIdAndUpdate(
          orderId,
          {
            $set: {
              statut: StatutCommande.PAID,
              'abonnements.$[].statut': StatutAbonnement.ACTIVE,
            },
          },
          { new: true },
        )
        .populate('user', 'firstName lastName email')
        .populate('cb', 'carteName carteNumber carteDate')
        .populate('abonnements.product', 'name slug priceMonth priceYear')
        .exec();

      if (!updatedCommande) {
        return ApiResponse.error('Commande introuvable');
      }

      return ApiResponse.success('Commande payee avec succes', updatedCommande);
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la mise a jour du statut de la commande',
        error,
      );
    }
  }

  async handleStripeWebhook(
    payload: Buffer | string,
    stripeSignature?: string,
  ) {
    try {
      const event = this.stripeService.constructEvent(payload, stripeSignature);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          metadata?: { orderId?: string };
        };
        const orderId = session.metadata?.orderId;

        if (!orderId) {
          return ApiResponse.error(
            "Le webhook Stripe ne contient pas d'identifiant de commande",
          );
        }

        return await this.markAsPaid(orderId);
      }

      return ApiResponse.success('Webhook Stripe recu', {
        type: event.type,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors du traitement du webhook', error);
    }
  }

  update(id: number, updateCommandeDto: UpdateCommandeDto) {
    return `This action updates a #${id} commande`;
  }

  remove(id: number) {
    return `This action removes a #${id} commande`;
  }

  private normalizeStartDate(dateDebut?: string) {
    const startDate = dateDebut ? new Date(dateDebut) : new Date();

    if (Number.isNaN(startDate.getTime())) {
      return new Date();
    }

    return startDate;
  }

  private computeEndDate(startDate: Date, periode: PeriodeAbonnement) {
    const endDate = new Date(startDate);

    if (periode === PeriodeAbonnement.ANNUEL) {
      endDate.setFullYear(endDate.getFullYear() + 1);
      return endDate;
    }

    endDate.setMonth(endDate.getMonth() + 1);
    return endDate;
  }

  private async buildStripeLineItems(createCommandeDto: CreateCommandeDto) {
    const lineItems: {
      stripePriceId?: string;
      quantity: number;
      productName?: string;
      unitAmount?: number;
      interval?: 'month' | 'year';
    }[] = [];
    const intervals = new Set<'month' | 'year'>();

    for (const abonnementDto of createCommandeDto.abonnements) {
      const ProductIdAsObjectId = await resolveIdOrThrow(
        abonnementDto.productId,
        (id) => this.productService.findOneById(id),
        'Produit',
      );
      const product = await this.productModel.findById(
        ProductIdAsObjectId,
        '_id name priceMonth priceYear stripePriceMonthId stripePriceYearId',
      );

      if (!product) {
        throw new Error(`Produit introuvable: ${abonnementDto.productId}`);
      }

      const stripePriceId =
        abonnementDto.periode === PeriodeAbonnement.ANNUEL
          ? product.stripePriceYearId
          : product.stripePriceMonthId;

      const unitPrice =
        abonnementDto.periode === PeriodeAbonnement.ANNUEL
          ? Number(product.priceYear ?? 0)
          : Number(product.priceMonth ?? 0);

      lineItems.push({
        stripePriceId,
        quantity: Number(abonnementDto.quantity ?? 1),
        productName: product.name,
        unitAmount: Math.round(unitPrice * 100),
        interval:
          abonnementDto.periode === PeriodeAbonnement.ANNUEL ? 'year' : 'month',
      });

      intervals.add(
        abonnementDto.periode === PeriodeAbonnement.ANNUEL ? 'year' : 'month',
      );
    }

    if (intervals.size > 1) {
      throw new Error(
        'Stripe Checkout ne supporte pas plusieurs abonnements avec des periodes differentes dans une meme session. Envoie uniquement des produits mensuels ou uniquement des produits annuels.',
      );
    }

    return lineItems;
  }

  private extractId(value: unknown) {
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }

    if (value && typeof value === 'object' && '_id' in value) {
      const nestedId = (value as { _id?: Types.ObjectId | string })._id;
      return nestedId ? nestedId.toString() : undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    return undefined;
  }
}
