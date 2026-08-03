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
import { AnalyticsService } from '../../shared/services/analytics.service';
import { SendEmailService } from '../../shared/services/sendemail.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CarteBancairesService } from '../carte_bancaires/carte_bancaires.service';
import { AdresseFacturationsService } from '../adresse_facturations/adresse_facturations.service';
import { CouponsService } from '../coupons/coupons.service';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import { AdresseFacturation } from '../adresse_facturations/entities/adresse_facturation.entity';
import { PushService } from '../push/push.service';

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
    private readonly analyticsService: AnalyticsService,
    private readonly sendEmailService: SendEmailService,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
    private readonly cartesService: CarteBancairesService,
    private readonly adressesService: AdresseFacturationsService,
    private readonly couponsService: CouponsService,
    private readonly pushService: PushService,
  ) {}

  // Achat invité : crée un compte pour l'email fourni, y rattache une carte +
  // une adresse, envoie un email d'activation (définir le mot de passe), puis
  // réutilise le flux de commande/paiement complet (TVA, abonnements, emails,
  // webhook 3-D Secure). Si l'email a déjà un compte, on refuse (connexion).
  async guestCheckout(dto: GuestCheckoutDto) {
    try {
      if (!dto.stripePaymentMethodId?.startsWith('pm_')) {
        return ApiResponse.error('Moyen de paiement invalide');
      }

      // Pré-validation produits/disponibilité (+ code promo) AVANT de créer le
      // compte, pour éviter de laisser un compte orphelin si la commande est
      // invalide.
      let htSum = 0;
      for (const ab of dto.abonnements) {
        if (!isValidObjectId(ab.productId)) {
          return ApiResponse.error('Produit invalide');
        }
        const product = await this.productModel.findById(
          ab.productId,
          '_id name stock priceMonth priceYear',
        );
        if (!product) {
          return ApiResponse.error(`Produit introuvable: ${ab.productId}`);
        }
        if (!Number.isFinite(Number(product.stock)) || Number(product.stock) <= 0) {
          return ApiResponse.error(
            `Le produit ${product.name} est actuellement indisponible`,
          );
        }
        const unitPrice =
          ab.periode === PeriodeAbonnement.ANNUEL
            ? Number(product.priceYear ?? 0)
            : Number(product.priceMonth ?? 0);
        htSum += unitPrice * Number(ab.quantity ?? 1);
      }

      if (dto.couponCode) {
        const v = await this.couponsService.validateCode(dto.couponCode, htSum);
        if (!v.valid) {
          return ApiResponse.error(v.message ?? 'Code promo invalide');
        }
      }

      // 1. Compte invité (refuse si l'email a déjà un compte).
      const guestResp = await this.usersService.createGuest({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      if (!guestResp.success || !guestResp.data) {
        return guestResp;
      }
      const { user, setupToken } = guestResp.data as any;
      const currentUser = {
        data: { _id: user._id, email: user.email, role: user.role },
      };

      // 2. Carte (attache le PaymentMethod au client Stripe, stocke masqué).
      const cardResp = await this.cartesService.create(
        { stripePaymentMethodId: dto.stripePaymentMethodId, isDefault: true } as any,
        currentUser,
      );
      if (!cardResp.success || !cardResp.data) {
        return cardResp;
      }
      const cbId = String((cardResp.data as any)._id);

      // 3. Adresse de facturation.
      const addrResp = await this.adressesService.create(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          adresse: dto.adresse,
          complementAdresse: dto.complementAdresse,
          city: dto.city,
          region: dto.region,
          country: dto.country,
          codePostal: dto.codePostal,
          phone: dto.phone,
          isDefault: true,
        } as any,
        currentUser,
      );
      if (!addrResp.success || !addrResp.data) {
        return addrResp;
      }
      const adresseFacturationId = String((addrResp.data as any)._id);

      // 4. Email d'activation du compte (définir le mot de passe).
      await this.safeSendEmail(
        () => this.sendEmailService.sendWelcomeSetPassword(user.email, setupToken),
        `guest-welcome ${user.email}`,
      );

      // 5. Commande + paiement Stripe : on réutilise tout le flux existant.
      return await this.createWithStripeCheckout(
        {
          cbId,
          adresseFacturationId,
          abonnements: dto.abonnements,
          couponCode: dto.couponCode,
        } as any,
        currentUser,
      );
    } catch (_error) {
      return ApiResponse.error("Erreur lors de l'achat invité");
    }
  }

  // Envoi d'email transactionnel sans jamais bloquer ni casser le flux metier :
  // on attend l'envoi (pour qu'il aboutisse avant la fin de la fonction
  // serverless) mais toute erreur SMTP est journalisee et avalee.
  private async safeSendEmail(action: () => Promise<unknown>, context: string) {
    try {
      await action();
    } catch (error) {
      console.error(`[EMAIL] Echec d'envoi (${context})`);
    }
  }

  // Taux de TVA applique aux commandes. Configurable via TVA_RATE (fraction,
  // ex. 0.20 = 20%). Defaut 20% (France). Borne a [0, 1] par securite.
  private resolveTvaRate(): number {
    const raw = Number(process.env.TVA_RATE);
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      return 0.2;
    }
    return raw;
  }

  // Arrondi monetaire au centime.
  private round2(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

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
      let totalHT = 0;
      let nbreProducts = 0;

      for (const abonnementDto of createCommandeDto.abonnements) {
        const ProductIdAsObjectId = await resolveIdOrThrow(
          abonnementDto.productId,
          (id) => this.productService.findOneById(id),
          'Produit',
        );
        const product = await this.productModel.findById(
          ProductIdAsObjectId,
          '_id name priceMonth priceYear stock',
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

        // Revalidation serveur de la disponibilite : on refuse toute commande
        // d'un produit indisponible (stock <= 0), meme si le panier client l'a
        // laisse passer. Empeche de payer pour un service indisponible.
        if (!Number.isFinite(Number(product.stock)) || Number(product.stock) <= 0) {
          return ApiResponse.error(
            `Le produit ${product.name} est actuellement indisponible`,
          );
        }

        const unitPrice =
          abonnementDto.periode === PeriodeAbonnement.ANNUEL
            ? Number(product.priceYear ?? 0)
            : Number(product.priceMonth ?? 0);

        const dateDebut = this.normalizeStartDate();
        const dateFin = this.computeEndDate(abonnementDto.periode);
        const linePrice = unitPrice * quantity;

        totalHT += linePrice;
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

      // Code promo (optionnel) : remise recalculée côté serveur sur le HT, jamais
      // d'après le client. Refus de la commande si le code est invalide/expiré.
      let discountAmount = 0;
      let appliedCouponCode: string | undefined;
      if (createCommandeDto.couponCode) {
        const v = await this.couponsService.validateCode(
          createCommandeDto.couponCode,
          totalHT,
        );
        if (!v.valid) {
          return ApiResponse.error(v.message ?? 'Code promo invalide');
        }
        discountAmount = Number(v.discount ?? 0);
        appliedCouponCode = v.code;
      }

      // TVA calculee cote serveur (jamais cote client). Taux unique configurable
      // via TVA_RATE (ex. 0.20 pour 20% France). La remise réduit la base taxable.
      const tvaRate = this.resolveTvaRate();
      const discountedHT = this.round2(Math.max(0, totalHT - discountAmount));
      const tvaAmount = this.round2(discountedHT * tvaRate);
      const totalTTC = this.round2(discountedHT + tvaAmount);

      const commande = new this.commandeModel({
        reference: this.sharedService.generateReference(),
        totalPrice: totalTTC,
        totalHT: this.round2(totalHT),
        discountAmount: this.round2(discountAmount),
        couponCode: appliedCouponCode,
        tvaRate,
        tvaAmount,
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
        return ApiResponse.notFound('Commande introuvable');
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
        return ApiResponse.notFound('Commande non trouvee');
      }
      const isAdmin = currentUser?.data?.role === UserRoles.ADMIN;
      const ownerId = this.extractId(commande?.user?._id);
      const isOwner = ownerId?.toString() === currentUser?.data?._id.toString();

      if (!isOwner && !isAdmin) {
        return ApiResponse.forbidden(
          "Vous n'etes pas proprietaire de cette commande",
        );
      }

      return ApiResponse.success('Commande recuperee avec succes', commande);
    } catch (error) {
      return ApiResponse.error('Erreur lors de la recuperation de la commande');
    }
  }

  // Cycle de vie des abonnements, déclenché par un cron (Vercel Cron). Passe à
  // FINISHED tout abonnement ACTIF dont l'échéance (dateFin) est dépassée, puis
  // prévient l'utilisateur par email. Idempotent : un abonnement déjà FINISHED
  // n'est pas retraité. Le renouvellement automatique (débit off-session) n'est
  // pas tenté ici — il reste manuel côté client (3-D Secure impossible en cron).
  async processExpiredSubscriptions() {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const commandes = await this.commandeModel
      .find({
        abonnements: {
          $elemMatch: {
            statut: StatutAbonnement.ACTIVE,
            dateFin: { $lte: nowIso },
          },
        },
      })
      .populate('user', 'firstName lastName email')
      .exec();

    let expiredAbonnements = 0;

    for (const commande of commandes) {
      let changed = false;
      for (const ab of commande.abonnements) {
        if (
          ab.statut === StatutAbonnement.ACTIVE &&
          ab.dateFin &&
          new Date(ab.dateFin).getTime() <= nowMs
        ) {
          ab.statut = StatutAbonnement.FINISHED;
          changed = true;
          expiredAbonnements++;
        }
      }

      if (changed) {
        await commande.save();
        this.analyticsService.track('subscription_expired', {
          periode: commande.periode,
        });
        const expiredUser = commande.user as any;
        const email = expiredUser?.email;
        if (email) {
          await this.safeSendEmail(
            () => this.sendEmailService.sendSubscriptionExpired(email),
            `expire ${commande.reference}`,
          );
        }
        // Notification push de fin d'abonnement (no-op sans VAPID).
        const expiredUserId = expiredUser?._id?.toString();
        if (expiredUserId) {
          this.pushService.sendToUser(expiredUserId, {
            title: 'Abonnement expiré',
            body: 'Un de vos abonnements a expiré. Renouvelez-le depuis votre espace.',
            url: '/account',
          }).catch(() => {});
        }
      }
    }

    return {
      scannedCommandes: commandes.length,
      expiredAbonnements,
    };
  }

  async markAsPaid(orderId: string) {
    try {
      if (!isValidObjectId(orderId)) {
        return ApiResponse.error("L'id de la commande est invalide");
      }

      // Statut avant mise a jour : permet d'emettre l'evenement analytics une
      // seule fois (la vraie transition PENDING → PAID), meme si markAsPaid est
      // rejoue par un retry de webhook Stripe.
      const previous = await this.commandeModel.findById(orderId, 'statut');

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
        return ApiResponse.notFound('Commande introuvable');
      }

      // Une seule fois, sur la vraie transition PENDING → PAID (pas sur un
      // retry de webhook) : evenement analytics + email de confirmation +
      // incrément de l'usage du code promo.
      if (previous && previous.statut !== StatutCommande.PAID) {
        this.analyticsService.track('order_paid', {
          amountTtc: updatedCommande.totalPrice,
          amountHt: updatedCommande.totalHT,
          products: updatedCommande.nbreProducts,
          periode: updatedCommande.periode,
        });

        if (updatedCommande.couponCode) {
          await this.couponsService.incrementUsage(updatedCommande.couponCode);
        }

        const paidUser = updatedCommande.user as any;
        const userEmail = paidUser?.email;
        if (userEmail) {
          await this.safeSendEmail(
            () =>
              this.sendEmailService.sendOrderConfirmation(
                userEmail,
                updatedCommande,
              ),
            `order ${updatedCommande.reference}`,
          );
        }
        // Notification push (no-op si l'utilisateur n'est pas abonné ou sans VAPID).
        const paidUserId = paidUser?._id?.toString();
        if (paidUserId) {
          this.pushService.sendToUser(paidUserId, {
            title: 'Commande confirmée ✓',
            body: `Votre commande ${updatedCommande.reference} a été payée avec succès.`,
            url: '/account',
          }).catch(() => {});
        }
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
          return ApiResponse.notFound('Commande introuvable');
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
  async cancel(id: string, currentUser?: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de la commande est invalide");
      }

      // Seul le propriétaire de la commande (ou un admin) peut l'annuler.
      const commande = await this.commandeModel.findById(id, 'user').exec();
      if (!commande) {
        return ApiResponse.notFound('Commande introuvable');
      }
      const isAdmin = currentUser?.data?.role === 'ADMIN';
      const isOwner = commande.user?.equals(currentUser?.data?._id);
      if (!isOwner && !isAdmin) {
        return ApiResponse.forbidden('Accès refusé');
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
        return ApiResponse.notFound('Commande introuvable');
      }

      return ApiResponse.success('Commande annulée avec succes');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de lannulation de la commande',
      );
    }
  }

  // Mise à jour manuelle du statut d'une commande par un administrateur.
  // Le statut des abonnements suit : PAID → ACTIF, CANCELED → DESACTIF. Pour
  // PENDING, les abonnements ne sont pas touchés (on évite d'écraser un état
  // FINISHED/CANCELED existant).
  async updateStatutByAdmin(id: string, statut: string, currentUser?: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id de la commande est invalide");
      }
      if (
        !Object.values(StatutCommande).includes(statut as StatutCommande)
      ) {
        return ApiResponse.error('Statut de commande invalide');
      }

      const setObj: Record<string, any> = { statut };
      if (statut === StatutCommande.PAID) {
        setObj['abonnements.$[].statut'] = StatutAbonnement.ACTIVE;
      } else if (statut === StatutCommande.CANCELED) {
        setObj['abonnements.$[].statut'] = StatutAbonnement.DESACTIVE;
      }

      const updated = await this.commandeModel
        .findByIdAndUpdate(id, { $set: setObj }, { new: true })
        .populate('user', 'firstName lastName email')
        .populate('abonnements.product', 'name slug')
        .exec();

      if (!updated) {
        return ApiResponse.notFound('Commande introuvable');
      }

      await this.auditService.record({
        action: 'order.status_changed',
        actorId: currentUser?.data?._id?.toString(),
        actorEmail: currentUser?.data?.email,
        targetType: 'order',
        targetId: id,
        metadata: { statut },
      });

      return ApiResponse.success(
        'Statut de la commande mis à jour',
        updated,
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la mise à jour du statut de la commande',
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
