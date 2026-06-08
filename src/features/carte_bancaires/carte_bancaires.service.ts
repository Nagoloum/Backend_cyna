import { Injectable } from '@nestjs/common';
import { CreateCarteBancaireDto } from './dto/create-carte_bancaire.dto';
import { UpdateCarteBancaireDto } from './dto/update-carte_bancaire.dto';
import { ApiResponse } from 'src/shared/responses/api-response';
import { InjectModel } from '@nestjs/mongoose';
import { CarteBancaire } from './entities/carte_bancaire.entity';
import { isValidObjectId, Model, Types } from 'mongoose';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { User } from '../users/entities/user.entity';
import { StripeService } from 'src/shared/services/stripe.service';

@Injectable()
export class CarteBancairesService {
  constructor(
    @InjectModel(CarteBancaire.name)
    private carteBancaireModel: Model<CarteBancaire>,

    @InjectModel(User.name)
    private userModel: Model<User>,
    private readonly stripeService: StripeService,
  ) {}

  // Cree un SetupIntent Stripe pour que le frontend puisse enregistrer une carte sans la debiter.
  async createSetupIntent(currentUser: any) {
    try {
      const userId = currentUser?.data?._id;

      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifié');
      }

      const user = await this.userModel
        .findById(userId, 'firstName lastName email stripeCustomerId')
        .exec();

      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }

      // Stripe a besoin d'un Customer pour pouvoir reutiliser la carte plus tard.
      const stripeCustomerId = await this.getOrCreateStripeCustomerId(user);
      const setupIntent =
        await this.stripeService.createSetupIntent(stripeCustomerId);

      return ApiResponse.success('SetupIntent Stripe cree avec succes', {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        stripeCustomerId,
      });
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la creation du SetupIntent Stripe',
        error,
      );
    }
  }

  // Sauvegarde une carte deja creee par Stripe via un PaymentMethod pm_...
  async create(
    createCarteBancaireDto: CreateCarteBancaireDto,
    currentUser: any,
  ) {
    try {
      const userId = currentUser?.data?._id;

      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifié');
      }

      if (!createCarteBancaireDto.stripePaymentMethodId?.startsWith('pm_')) {
        return ApiResponse.error('PaymentMethod Stripe invalide');
      }

      const user = await this.userModel
        .findById(userId, 'firstName lastName email stripeCustomerId')
        .exec();

      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }

      // Evite d'enregistrer deux fois le meme PaymentMethod pour le meme user.
      const exist = await this.carteBancaireModel.exists({
        stripePaymentMethodId: createCarteBancaireDto.stripePaymentMethodId,
        user: userId,
      });

      if (exist) {
        return ApiResponse.error('Cette carte bancaire existe deja');
      }

      // On recupere la carte chez Stripe pour verifier son type et lire brand/last4/expiration.
      const stripeCustomerId = await this.getOrCreateStripeCustomerId(user);
      const paymentMethod = await this.stripeService.retrievePaymentMethod(
        createCarteBancaireDto.stripePaymentMethodId,
      );

      if (paymentMethod.type !== 'card' || !paymentMethod.card) {
        return ApiResponse.error(
          'Le PaymentMethod Stripe doit etre une carte bancaire',
        );
      }

      const attachedCustomerId = this.extractStripeCustomerId(
        paymentMethod.customer,
      );

      // Un PaymentMethod deja attache a un autre Customer ne doit pas etre reutilise ici.
      if (attachedCustomerId && attachedCustomerId !== stripeCustomerId) {
        return ApiResponse.error(
          'Cette carte Stripe est deja liee a un autre client',
        );
      }

      // Si Stripe ne l'a pas deja fait via le SetupIntent, on attache la carte au Customer.
      const savedPaymentMethod = attachedCustomerId
        ? paymentMethod
        : await this.stripeService.attachPaymentMethodToCustomer(
            createCarteBancaireDto.stripePaymentMethodId,
            stripeCustomerId,
          );
      const card = savedPaymentMethod.card ?? paymentMethod.card;

      // Si la carte devient la carte par defaut, on met aussi a jour Stripe et les autres cartes en base.
      if (createCarteBancaireDto.isDefault) {
        await Promise.all([
          this.stripeService.updateDefaultPaymentMethod(
            stripeCustomerId,
            savedPaymentMethod.id,
          ),
          this.carteBancaireModel.updateMany(
            { user: userId, isDefault: true },
            { $set: { isDefault: false } },
          ),
        ]);
      }

      // On ne stocke pas le numero complet ni le CVV: seulement un affichage masque et les IDs Stripe.
      const newCarteBancaire = new this.carteBancaireModel({
        carteName:
          createCarteBancaireDto.carteName ||
          `${card.brand.toUpperCase()} ${card.last4}`,
        carteNumber: `**** **** **** ${card.last4}`,
        carteDate: `${card.exp_month}/${card.exp_year}`,
        carteCVV: '***',
        isDefault: Boolean(createCarteBancaireDto.isDefault),
        stripePaymentMethodId: savedPaymentMethod.id,
        stripeCustomerId,
        user: userId,
      });

      const savedCarteBancaire = await newCarteBancaire.save();
      return ApiResponse.success(
        'Carte bancaire crée avec success',
        savedCarteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la création de la carte bancaire',
        error,
      );
    }
  }

  // Retourne toutes les cartes sauvegardees par l'utilisateur connecte.
  async findByUser(currentUser: any) {
    try {
      const carteBancaire = await this.carteBancaireModel
        .find(
          {
            user: currentUser?.data?._id,
          },
          '-user',
        )
        .sort({ isDefault: -1, createdAt: -1 });
      return ApiResponse.success(
        'Carte bancaire recuperee avec success',
        carteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la recupération de la carte bancaire de l'utilisateur",
      );
    }
  }

  // Retourne une carte par son id apres avoir verifie que l'utilisateur y a acces.
  async findOne(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(id);

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }
      return ApiResponse.success(
        'Carte bancaire recuperee avec success',
        carteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la recupération de la carte bancaire',
      );
    }
  }

  // Verifie et retourne la carte par defaut demandee pour l'utilisateur connecte.
  async cbDefault(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      await this.carteBancaireModel.updateMany(
        { user: currentUser?.data?._id, _id: { $ne: new Types.ObjectId(id) } },
        { $set: { isDefault: false } },
      );
      const carteBancaire = await this.carteBancaireModel.updateOne(
        {
          user: currentUser?.data?._id,
          _id: new Types.ObjectId(id),
        },
        { $set: { isDefault: true } },
      );

      if (carteBancaire.matchedCount === 0) {
        return ApiResponse.error('Carte bancaire par defaut non trouvee');
      }

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire non trouvee');
      }
      return ApiResponse.success('Carte bancaire par defaut mise a jour');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la recupération de la carte bancaire',
      );
    }
  }

  // Met a jour une carte apres verification de l'existence et des droits utilisateur.
  async update(
    id: string,
    updateCarteBancaireDto: UpdateCarteBancaireDto,
    currentUser: any,
  ) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(
        id,
        '_id user',
      );

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }

      return ApiResponse.success(
        'Carte bancaire mise a jour avec success',
        await this.carteBancaireModel.findByIdAndUpdate(id, {
          $set: updateCarteBancaireDto,
        }),
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la mise à jour de la carte bancaire',
      );
    }
  }

  // Supprime une carte apres verification de l'existence et des droits utilisateur.
  async remove(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(
        id,
        '_id user',
      );

      if (!carteBancaire) {
        return ApiResponse.error('carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }
      await this.carteBancaireModel.findByIdAndDelete(id);

      return ApiResponse.success('Carte bancaire supprimee avec success');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la suppression de la carte bancaire',
      );
    }
  }

  // Recupere le Customer Stripe du user, ou le cree si c'est sa premiere carte Stripe.
  private async getOrCreateStripeCustomerId(user: User) {
    if (user.stripeCustomerId) {
      try {
        await this.stripeService.retrieveCustomer(user.stripeCustomerId);
        return user.stripeCustomerId;
      } catch (error) {
        if (!this.isStripeResourceMissingError(error)) {
          throw error;
        }

        user.stripeCustomerId = undefined;
      }
    }

    const stripeCustomer = await this.stripeService.createCustomer({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      metadata: {
        userId: user._id.toString(),
      },
    });

    await this.userModel.findByIdAndUpdate(user._id, {
      stripeCustomerId: stripeCustomer.id,
    });

    return stripeCustomer.id;
  }

  // Detecte le cas ou l'id stocke en base n'existe pas dans le compte Stripe courant.
  private isStripeResourceMissingError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const stripeError = error as {
      code?: string;
      raw?: { code?: string };
    };

    return (
      stripeError.code === 'resource_missing' ||
      stripeError.raw?.code === 'resource_missing'
    );
  }

  // Normalise le champ customer renvoye par Stripe: parfois c'est un id, parfois un objet.
  private extractStripeCustomerId(customer: unknown) {
    if (!customer) {
      return undefined;
    }

    if (typeof customer === 'string') {
      return customer;
    }

    if (typeof customer === 'object' && 'id' in customer) {
      return (customer as { id?: string }).id;
    }

    return undefined;
  }
}
