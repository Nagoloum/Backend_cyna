import { escapeRegex } from '../../shared/generic/escape-regex';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { Commande } from './entities/commande.entity';
import { ApiResponse } from '../../shared/responses/api-response';
import { QueryDto } from '../../shared/dto/query.dto';
import { SharedService } from '../../shared/services/shared.service';
import { Product } from '../products/entities/product.entity';
import { CarteBancaire } from '../carte_bancaires/entities/carte_bancaire.entity';
import { PeriodeAbonnement } from '../../shared/common/periode-abonnement.enum';
import { StatutAbonnement } from '../../shared/common/statut-abonnement.enum';
import { StatutCommande } from '../../shared/common/statut-commande.enum';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { resolveIdOrThrow } from '../../shared/generic/resolveId';
import { ProductsService } from '../products/products.service';
import { StripeService } from '../../shared/services/stripe.service';
import { AdresseFacturation } from '../adresse_facturations/entities/adresse_facturation.entity';

type BuiltAbonnement = {
  dateDebut: string;
  dateFin: string;
  quantity: number;
  periode: PeriodeAbonnement;
  price: number;
  keyLicence: string;
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
    @InjectModel(AdresseFacturation.name)
    private readonly adresseFacturationModel: Model<AdresseFacturation>,
    private readonly sharedService: SharedService,
    private readonly productService: ProductsService,
    private readonly stripeService: StripeService,
  ) {}

  async create(createCommandeDto: CreateCommandeDto, currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      const carteBancaire = await this.carteBancaireModel.findById(
        createCommandeDto.cbId,
        '_id user stripePaymentMethodId stripeCustomerId',
      );

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire introuvable');
      }

      if (!carteBancaire.user?.equals(userId)) {
        return ApiResponse.error(
          'Vous ne pouvez pas utiliser cette carte bancaire',
        );
      }

      const adresseFacturation = await this.adresseFacturationModel.findById(
        createCommandeDto.adresseFacturationId,
        '_id user',
      );

      if (!adresseFacturation) {
        return ApiResponse.error('Adresse de facturation introuvable');
      }

      if (!adresseFacturation.user?.equals(userId)) {
        return ApiResponse.error(
          'Vous ne pouvez pas utiliser cette adresse de facturation',
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

        const dateDebut = this.normalizeStartDate();
        const dateFin = this.computeEndDate(abonnementDto.periode);
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
          keyLicence: this.sharedService.generateLicenseKey(),
        });
      }

      const commande = new this.commandeModel({
        reference: this.sharedService.generateReference(),
        totalPrice,
        nbreProducts,
        statut: StatutCommande.PENDING,
        cb: new Types.ObjectId(createCommandeDto.cbId),
        addresseFacturation: new Types.ObjectId(
          createCommandeDto.adresseFacturationId,
        ),
        user: new Types.ObjectId(userId),
        periode: builtAbonnements[0].periode,
        abonnements: builtAbonnements,
      });
      const savedCommande = await commande.save();

      const populatedCommande = await this.commandeModel
        .findById(savedCommande._id, '_id')
        .exec();

      return ApiResponse.success(
        'Commande creee avec succes',
        populatedCommande,
      );
    } catch (error) {
      return ApiResponse.error('Erreur lors de la creation de la commande');
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
      const orderId =
        this.extractId(commande._id) ?? commande?._id?.toString?.();

      if (!orderId) {
        return ApiResponse.error(
          "Impossible de recuperer l'identifiant de la commande",
        );
      }

      const savedCommande = await this.commandeModel
        .findById(orderId, '_id totalPrice cb')
        .populate('cb', 'stripePaymentMethodId stripeCustomerId')
        .exec();

      if (!savedCommande) {
        return ApiResponse.error('Commande introuvable');
      }

      const carteBancaire = savedCommande.cb as unknown as CarteBancaire;
      const stripeAmount = this.toStripeAmount(savedCommande.totalPrice);

      if (
        !carteBancaire?.stripePaymentMethodId ||
        !carteBancaire?.stripeCustomerId
      ) {
        return ApiResponse.error(
          "Cette carte n'est pas reliée a Stripe. Elle doit etre sauvegardee via un PaymentMethod Stripe avant de pouvoir etre utilisee pour payer.",
        );
      }

      if (stripeAmount <= 0) {
        return ApiResponse.error('Le montant de la commande est invalide');
      }

      const paymentIntent =
        await this.stripeService.createPaymentIntentWithSavedCard({
          amount: stripeAmount,
          customerId: carteBancaire.stripeCustomerId,
          paymentMethodId: carteBancaire.stripePaymentMethodId,
          orderId,
        });

      if (paymentIntent.status === 'succeeded') {
        const updatedCommande = await this.markAsPaid(orderId);

        if (!updatedCommande.success) {
          return updatedCommande;
        }

        return ApiResponse.success('Paiement Stripe effectue avec succes', {
          orderId,
          paymentIntentId: paymentIntent.id,
          paymentStatus: paymentIntent.status,
          status: 'PAID',
          commande: updatedCommande.data,
        });
      }

      if (
        paymentIntent.status === 'requires_action' ||
        paymentIntent.status === 'requires_confirmation'
      ) {
        return ApiResponse.success('Authentification Stripe requise', {
          orderId,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          paymentStatus: paymentIntent.status,
          status: 'REQUIRES_ACTION',
        });
      }

      if (paymentIntent.status === 'processing') {
        return ApiResponse.success('Paiement Stripe en cours de traitement', {
          orderId,
          paymentIntentId: paymentIntent.id,
          paymentStatus: paymentIntent.status,
          status: 'PENDING',
        });
      }

      return ApiResponse.error("Le paiement Stripe n'a pas pu etre finalise", {
        orderId,
        paymentIntentId: paymentIntent.id,
        paymentStatus: paymentIntent.status,
        status: 'PENDING',
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors du paiement Stripe avec la carte sauvegardee',
        error,
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
          { reference: { $regex: escapeRegex(search), $options: 'i' } },
          { statut: { $regex: escapeRegex(search), $options: 'i' } },
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
        return ApiResponse.error('Utilisateur non authentifié');
      }

      const {
        page = 1,
        limit = 10,
        sortOrder,
        search,
        year,
        serviceType,
        status,
      } = queryDto;

      const pageNumber = parseInt(page.toString(), 10) || 1;
      const limitNumber = parseInt(limit.toString(), 10) || 10;
      const skip = (pageNumber - 1) * limitNumber;
      const selectedSortOrder: 1 | -1 = sortOrder === 'asc' ? 1 : -1;

      // --- PIPELINE D'AGRÉGATION ---
      const pipeline: any[] = [
        // 1. Filtrer par utilisateur d'abord (très important pour la performance)
        { $match: { user: new Types.ObjectId(userId) } },

        // // 2. "Joindre" les produits (équivalent de populate)
        // {
        //   $lookup: {
        //     from: 'products', // Nom exact de ta collection de produits en DB
        //     localField: 'abonnements.product',
        //     foreignField: '_id',
        //     as: 'productDetails',
        //   },
        // },

        // 3. Ajouter des champs calculés pour la recherche (Date -> String)
        {
          $addFields: {
            createdAtStr: {
              $dateToString: { format: '%d/%m/%Y %H:%M', date: '$createdAt' },
            },
          },
        },
        {
          $project: {
            _id: 1,
            createdAt: 1,
            statut: 1,
            serviceType: 1,
            reference: 1,
            totalPrice: 1,
            nbreProducts: 1,
            periode: 1,
            // Champs techniques pour les filtres
            createdAtStr: 1,
          },
        },
      ];

      // 4. Filtres dynamiques
      const matchConditions: any = {};

      if (search) {
        matchConditions.$or = [
          { createdAtStr: { $regex: escapeRegex(search), $options: 'i' } },
          // { 'productDetails.name': { $regex: escapeRegex(search), $options: 'i' } },
          { statut: { $regex: escapeRegex(search), $options: 'i' } },
        ];
      }

      if (year) {
        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year}-12-31T23:59:59.999Z`);
        matchConditions.createdAt = { $gte: start, $lte: end };
      }

      if (serviceType) {
        matchConditions['abonnements.type'] = serviceType;
      }

      if (status) {
        matchConditions.statut = status;
      }

      // Appliquer les filtres s'ils existent
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // 5. Tri, Skip et Limit
      pipeline.push({ $sort: { createdAt: selectedSortOrder } });

      // Utilisation de $facet pour récupérer les données ET le total en une seule requête
      const aggregationResult = await this.commandeModel
        .aggregate([
          ...pipeline,
          {
            $facet: {
              metadata: [{ $count: 'total' }],
              data: [{ $skip: skip }, { $limit: limitNumber }],
            },
          },
        ])
        .exec();

      const data = aggregationResult[0].data;
      const total = aggregationResult[0].metadata[0]?.total || 0;

      // 6. Regroupement par année (Logique JS pour l'affichage)
      const groupedData = data.reduce(
        (acc, curr) => {
          const yearKey = new Date(curr.createdAt).getFullYear().toString();
          if (!acc[yearKey]) acc[yearKey] = [];
          acc[yearKey].push(curr);
          return acc;
        },
        {} as Record<string, any[]>,
      );

      return ApiResponse.success('Liste des commandes récupérée', {
        results: year ? data : groupedData,
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPage: Math.ceil(total / limitNumber),
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return ApiResponse.error('Erreur lors de la récupération des commandes');
    }
  }

  async findOne(reference: string, currentUser: any) {
    try {
      const commande = await this.commandeModel
        .findOne({ reference: reference.trim() })
        .populate('user', 'firstName lastName email role')
        .populate('cb', 'carteName carteNumber carteDate')
        .populate('abonnements.product', 'name slug images')
        .populate('addresseFacturation', '-user')
        .exec();
      if (!commande) {
        return ApiResponse.error('Commande non trouvee');
      }
      const isAdmin = currentUser?.data?.role === UserRoles.ADMIN;
      const ownerId = this.extractId(commande?.user?._id);
      const isOwner = ownerId?.toString() === currentUser?.data?._id.toString();

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
        .populate('abonnements.product', 'name slug')
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

  async confirmPaymentSuccess(
    orderId?: string,
    sessionId?: string,
    paymentIntentId?: string,
    currentUser?: any,
  ) {
    try {
      if (!orderId) {
        return ApiResponse.error("L'identifiant de commande est obligatoire");
      }

      // La confirmation est réservée au propriétaire de la commande (ou admin).
      if (currentUser !== undefined) {
        if (!isValidObjectId(orderId)) {
          return ApiResponse.error("L'identifiant de commande est invalide");
        }
        const owned = await this.commandeModel.findById(orderId, 'user').exec();
        if (!owned) {
          return ApiResponse.error('Commande introuvable');
        }
        const isAdmin = currentUser?.data?.role === 'ADMIN';
        const isOwner = owned.user?.equals(currentUser?.data?._id);
        if (!isOwner && !isAdmin) {
          return ApiResponse.error('Accès refusé');
        }
      }

      if (paymentIntentId) {
        const paymentIntent =
          await this.stripeService.retrievePaymentIntent(paymentIntentId);

        if (paymentIntent.metadata?.orderId !== orderId) {
          return ApiResponse.error(
            'Le PaymentIntent Stripe ne correspond pas a la commande demandee',
          );
        }

        if (paymentIntent.status !== 'succeeded') {
          return ApiResponse.success('Paiement Stripe non finalise', {
            orderId,
            paymentIntentId,
            paymentStatus: paymentIntent.status,
            status: 'PENDING',
          });
        }

        const updatedCommande = await this.markAsPaid(orderId);

        if (!updatedCommande.success) {
          return updatedCommande;
        }

        return ApiResponse.success('Commande payée avec succes', {
          orderId,
          paymentIntentId,
          paymentStatus: paymentIntent.status,
          commande: updatedCommande.data,
        });
      }

      if (!sessionId) {
        return ApiResponse.error(
          'Le session_id Stripe ou payment_intent Stripe est obligatoire',
        );
      }

      const session =
        await this.stripeService.retrieveCheckoutSession(sessionId);

      if (session.metadata?.orderId !== orderId) {
        return ApiResponse.error(
          'La session Stripe ne correspond pas a la commande demandee',
        );
      }

      if (session.payment_status !== 'paid') {
        return ApiResponse.success('Paiement Stripe non finalise', {
          orderId,
          sessionId,
          paymentStatus: session.payment_status,
          status: 'PENDING',
        });
      }

      const updatedCommande = await this.markAsPaid(orderId);

      if (!updatedCommande.success) {
        return updatedCommande;
      }

      return ApiResponse.success('Commande payée avec succes', {
        orderId,
        sessionId,
        paymentStatus: session.payment_status,
        commande: updatedCommande.data,
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la confirmation du paiement Stripe',
        error,
      );
    }
  }
  async findAbonnementsByUser(currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifié');
      }

      const commandes = await this.commandeModel
        .find({ user: new Types.ObjectId(userId) }, 'abonnements reference')
        .populate({
          path: 'abonnements.product',
          select: 'name slug images priceMonth priceYear',
        })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      // On renvoie les dates brutes (ISO) : le frontend les formate et calcule
      // la progression / les jours restants, et a besoin des prix produit pour
      // l'aperçu lors d'une modification.
      const flattenedAbonnements = commandes.flatMap((commande) =>
        (commande.abonnements ?? []).map((abonnement) => ({
          ...abonnement,
          commandeReference: commande.reference,
        })),
      );

      return ApiResponse.success(
        "Abonnements de l'utilisateur récupérés",
        flattenedAbonnements,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return ApiResponse.error(
        "Erreur lors de la récupération des abonnements de l'utilisateur",
      );
    }
  }

  async resilierAbonnementsByUser(id: string, currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifié');
      }

      const commande = await this.commandeModel
        .findOne({
          abonnements: { $elemMatch: { _id: new Types.ObjectId(id) } },
          user: new Types.ObjectId(userId),
        })
        .exec();

      if (!commande) {
        return ApiResponse.error('Abonnement introuvable pour cet utilisateur');
      }
      const abonnementIndex = commande.abonnements.findIndex((abonnement) =>
        abonnement._id.equals(id),
      );

      if (abonnementIndex === -1) {
        return ApiResponse.error('Abonnement introuvable dans la commande');
      }

      commande.abonnements[abonnementIndex].statut = StatutAbonnement.CANCELED;
      await commande.save();

      return ApiResponse.success('Abonnement résilié avec succès');
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la résiliation des abonnements de l'utilisateur",
      );
    }
  }

  // Modifier un abonnement : quantité et/ou période. Le prix et la date de fin
  // sont recalculés à partir du produit. Aucun paiement n'est déclenché.
  async updateAbonnement(id: string, dto: any, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de l'abonnement est invalide");
      }
      const userId = currentUser?.data?._id;

      const commande = await this.commandeModel.findOne({
        abonnements: { $elemMatch: { _id: new Types.ObjectId(id) } },
        user: new Types.ObjectId(userId),
      });

      if (!commande) {
        return ApiResponse.error('Abonnement introuvable pour cet utilisateur');
      }

      const abonnement = commande.abonnements.find((a) => a._id.equals(id));
      if (!abonnement) {
        return ApiResponse.error('Abonnement introuvable dans la commande');
      }
      if (abonnement.statut === StatutAbonnement.CANCELED) {
        return ApiResponse.error('Impossible de modifier un abonnement résilié');
      }

      const quantity =
        dto?.quantity !== undefined ? Number(dto.quantity) : abonnement.quantity;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return ApiResponse.error('La quantité doit être supérieure à 0');
      }

      const periode = dto?.periode ?? abonnement.periode;
      if (
        periode !== PeriodeAbonnement.MENSUEL &&
        periode !== PeriodeAbonnement.ANNUEL
      ) {
        return ApiResponse.error('Période invalide');
      }

      const product = await this.productModel.findById(
        abonnement.product,
        '_id priceMonth priceYear',
      );
      if (!product) {
        return ApiResponse.error('Produit introuvable');
      }

      const unitPrice =
        periode === PeriodeAbonnement.ANNUEL
          ? Number(product.priceYear ?? 0)
          : Number(product.priceMonth ?? 0);

      abonnement.quantity = quantity;
      abonnement.periode = periode;
      abonnement.price = unitPrice * quantity;
      abonnement.dateFin = this.addPeriod(
        new Date(abonnement.dateDebut),
        periode,
      ).toISOString();

      // Totaux de la commande recalculés pour rester cohérents.
      commande.totalPrice = commande.abonnements.reduce(
        (s, a) => s + Number(a.price ?? 0),
        0,
      );
      commande.nbreProducts = commande.abonnements.reduce(
        (s, a) => s + Number(a.quantity ?? 0),
        0,
      );
      commande.periode = commande.abonnements[0].periode;

      await commande.save();

      return ApiResponse.success('Abonnement mis à jour avec succès', abonnement);
    } catch (error) {
      return ApiResponse.error("Erreur lors de la mise à jour de l'abonnement");
    }
  }

  // Renouveler un abonnement : débit off-session de la carte (par défaut, sinon
  // celle de la commande), puis prolongation de la date de fin + réactivation.
  async renouvelerAbonnement(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de l'abonnement est invalide");
      }
      const userId = currentUser?.data?._id;

      const commande = await this.commandeModel.findOne({
        abonnements: { $elemMatch: { _id: new Types.ObjectId(id) } },
        user: new Types.ObjectId(userId),
      });
      if (!commande) {
        return ApiResponse.error('Abonnement introuvable pour cet utilisateur');
      }
      const abonnement = commande.abonnements.find((a) => a._id.equals(id));
      if (!abonnement) {
        return ApiResponse.error('Abonnement introuvable dans la commande');
      }

      let carte = await this.carteBancaireModel.findOne(
        { user: new Types.ObjectId(userId), isDefault: true },
        'stripePaymentMethodId stripeCustomerId',
      );
      if (!carte) {
        carte = await this.carteBancaireModel.findById(
          commande.cb,
          'stripePaymentMethodId stripeCustomerId',
        );
      }
      if (!carte?.stripePaymentMethodId || !carte?.stripeCustomerId) {
        return ApiResponse.error(
          'Aucune carte Stripe disponible pour le renouvellement',
        );
      }

      const amount = this.toStripeAmount(abonnement.price);
      if (amount <= 0) {
        return ApiResponse.error('Le montant du renouvellement est invalide');
      }

      const commandeId =
        this.extractId(commande._id) ?? commande?._id?.toString?.();

      const paymentIntent =
        await this.stripeService.createPaymentIntentWithSavedCard({
          amount,
          customerId: carte.stripeCustomerId,
          paymentMethodId: carte.stripePaymentMethodId,
          orderId: commandeId as string,
          idempotencyKey: `renew-${id}-${amount}-${abonnement.dateFin}`,
          metadata: { type: 'renew', abonnementId: id },
        });

      if (paymentIntent.status === 'succeeded') {
        this.extendAbonnement(abonnement);
        await commande.save();
        return ApiResponse.success('Abonnement renouvelé avec succès', {
          status: 'PAID',
          abonnementId: id,
          paymentIntentId: paymentIntent.id,
          abonnement,
        });
      }

      if (
        paymentIntent.status === 'requires_action' ||
        paymentIntent.status === 'requires_confirmation'
      ) {
        return ApiResponse.success('Authentification Stripe requise', {
          status: 'REQUIRES_ACTION',
          abonnementId: id,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
        });
      }

      return ApiResponse.error(
        "Le paiement du renouvellement n'a pas pu être finalisé",
        { status: 'PENDING', abonnementId: id, paymentIntentId: paymentIntent.id },
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors du renouvellement de l'abonnement",
        error,
      );
    }
  }

  // Finalise un renouvellement après authentification 3-D Secure côté frontend.
  async confirmRenouvellement(
    id: string,
    paymentIntentId: string,
    currentUser: any,
  ) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de l'abonnement est invalide");
      }
      if (!paymentIntentId) {
        return ApiResponse.error('PaymentIntent manquant');
      }
      const userId = currentUser?.data?._id;

      const commande = await this.commandeModel.findOne({
        abonnements: { $elemMatch: { _id: new Types.ObjectId(id) } },
        user: new Types.ObjectId(userId),
      });
      if (!commande) {
        return ApiResponse.error('Abonnement introuvable pour cet utilisateur');
      }
      const abonnement = commande.abonnements.find((a) => a._id.equals(id));
      if (!abonnement) {
        return ApiResponse.error('Abonnement introuvable dans la commande');
      }

      const paymentIntent =
        await this.stripeService.retrievePaymentIntent(paymentIntentId);

      if (paymentIntent.metadata?.abonnementId !== id) {
        return ApiResponse.error(
          'Le paiement ne correspond pas à cet abonnement',
        );
      }
      if (paymentIntent.status !== 'succeeded') {
        return ApiResponse.success('Paiement non finalisé', {
          status: 'PENDING',
          abonnementId: id,
        });
      }

      this.extendAbonnement(abonnement);
      await commande.save();

      return ApiResponse.success('Abonnement renouvelé avec succès', {
        status: 'PAID',
        abonnementId: id,
        abonnement,
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la confirmation du renouvellement',
      );
    }
  }

  async cancel(id: string, currentUser?: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de la commande est invalide");
      }

      // Seul le propriétaire de la commande (ou un admin) peut l'annuler.
      const commande = await this.commandeModel.findById(id, 'user').exec();
      if (!commande) {
        return ApiResponse.error('Commande introuvable');
      }
      const isAdmin = currentUser?.data?.role === 'ADMIN';
      const isOwner = commande.user?.equals(currentUser?.data?._id);
      if (!isOwner && !isAdmin) {
        return ApiResponse.error('Accès refusé');
      }

      const cancelledCommande = await this.commandeModel
        .findByIdAndUpdate(
          id,
          {
            $set: {
              statut: StatutCommande.CANCELED,
              'abonnements.$[].statut': StatutAbonnement.DESACTIVE,
            },
          },
          { new: true },
        )
        .exec();

      if (!cancelledCommande) {
        return ApiResponse.error('Commande introuvable');
      }

      return ApiResponse.success('Commande annulée avec succes');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de lannulation de la commande',
      );
    }
  }

  private normalizeStartDate() {
    const startDate = new Date();

    if (Number.isNaN(startDate.getTime())) {
      return new Date();
    }

    return startDate;
  }

  private computeEndDate(periode: PeriodeAbonnement) {
    const endDate = new Date();

    if (periode === PeriodeAbonnement.ANNUEL) {
      endDate.setFullYear(endDate.getFullYear() + 1);
      return endDate;
    }

    endDate.setMonth(endDate.getMonth() + 1);
    return endDate;
  }

  // Ajoute une période (mois/année) à une date donnée.
  private addPeriod(date: Date, periode: PeriodeAbonnement) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return this.computeEndDate(periode);
    }
    if (periode === PeriodeAbonnement.ANNUEL) {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  // Prolonge un abonnement d'une période (à partir de sa fin si encore valide,
  // sinon à partir d'aujourd'hui) et le réactive.
  private extendAbonnement(abonnement: any) {
    const now = new Date();
    const currentEnd = new Date(abonnement.dateFin);
    const base =
      !Number.isNaN(currentEnd.getTime()) && currentEnd > now ? currentEnd : now;
    abonnement.dateFin = this.addPeriod(base, abonnement.periode).toISOString();
    abonnement.statut = StatutAbonnement.ACTIVE;
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

  private toStripeAmount(amount: number) {
    return Math.round(Number(amount ?? 0) * 100);
  }
}
