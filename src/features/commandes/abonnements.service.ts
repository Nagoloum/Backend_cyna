import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Commande } from './entities/commande.entity';
import { CarteBancaire } from '../carte_bancaires/entities/carte_bancaire.entity';
import { Product } from '../products/entities/product.entity';
import { ApiResponse } from '../../shared/responses/api-response';
import { StatutAbonnement } from '../../shared/common/statut-abonnement.enum';
import { PeriodeAbonnement } from '../../shared/common/periode-abonnement.enum';
import { StripeService } from '../../shared/services/stripe.service';
import { AnalyticsService } from '../../shared/services/analytics.service';
import { SendEmailService } from '../../shared/services/sendemail.service';

/**
 * Gestion du cycle de vie des abonnements (hors création initiale).
 *
 * Responsabilités : consulter, résilier, modifier, renouveler et confirmer les
 * abonnements d'un utilisateur. CommandesService s'occupe de la création des
 * commandes et du flux de paiement initial.
 */
@Injectable()
export class AbonnementsService {
  constructor(
    @InjectModel(Commande.name) private readonly commandeModel: Model<Commande>,
    @InjectModel(CarteBancaire.name)
    private readonly carteBancaireModel: Model<CarteBancaire>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly stripeService: StripeService,
    private readonly analyticsService: AnalyticsService,
    private readonly sendEmailService: SendEmailService,
  ) {}

  async findByUser(currentUser: any) {
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

      // Renvoie les dates brutes (ISO) : le frontend les formate et calcule
      // la progression. Les prix produit sont inclus pour l'aperçu modif.
      const flat = commandes.flatMap((c) =>
        (c.abonnements ?? []).map((ab) => ({ ...ab, commandeReference: c.reference })),
      );

      return ApiResponse.success("Abonnements de l'utilisateur récupérés", flat);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return ApiResponse.error("Erreur lors de la récupération des abonnements");
    }
  }

  async resilier(id: string, currentUser: any) {
    try {
      const userId = currentUser?.data?._id;
      if (!userId || !isValidObjectId(userId)) {
        return ApiResponse.error('Utilisateur non authentifié');
      }

      const commande = await this.commandeModel.findOne({
        abonnements: { $elemMatch: { _id: new Types.ObjectId(id) } },
        user: new Types.ObjectId(userId),
      });

      if (!commande) {
        return ApiResponse.error('Abonnement introuvable pour cet utilisateur');
      }

      const idx = commande.abonnements.findIndex((a) => a._id.equals(id));
      if (idx === -1) {
        return ApiResponse.error('Abonnement introuvable dans la commande');
      }

      commande.abonnements[idx].statut = StatutAbonnement.CANCELED;
      await commande.save();

      this.analyticsService.track('subscription_canceled', {
        periode: commande.abonnements[idx].periode,
      });

      const email = currentUser?.data?.email;
      if (email) {
        await this.safeSendEmail(
          () =>
            this.sendEmailService.sendCancellationConfirmation(email, {
              periode: commande.abonnements[idx].periode,
            }),
          `cancel ${id}`,
        );
      }

      return ApiResponse.success('Abonnement résilié avec succès');
    } catch {
      return ApiResponse.error("Erreur lors de la résiliation de l'abonnement");
    }
  }

  // Modifier la quantité et/ou la période d'un abonnement actif. Le prix et la
  // date de fin sont recalculés à partir du produit. Aucun paiement n'est déclenché.
  async update(id: string, dto: any, currentUser: any) {
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

      const quantity = dto?.quantity !== undefined
        ? Number(dto.quantity)
        : abonnement.quantity;
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

      // Recalcul des totaux de la commande (TVA incluse).
      const tvaRate = this.resolveTvaRate();
      const newTotalHT = commande.abonnements.reduce(
        (s, a) => s + Number(a.price ?? 0),
        0,
      );
      commande.totalHT = this.round2(newTotalHT);
      commande.tvaRate = tvaRate;
      commande.tvaAmount = this.round2(newTotalHT * tvaRate);
      commande.totalPrice = this.round2(newTotalHT + commande.tvaAmount);
      commande.nbreProducts = commande.abonnements.reduce(
        (s, a) => s + Number(a.quantity ?? 0),
        0,
      );
      commande.periode = commande.abonnements[0].periode;

      await commande.save();

      return ApiResponse.success('Abonnement mis à jour avec succès', abonnement);
    } catch {
      return ApiResponse.error("Erreur lors de la mise à jour de l'abonnement");
    }
  }

  // Renouveler un abonnement par débit off-session de la carte enregistrée.
  async renouveler(id: string, currentUser: any) {
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

      // Carte par défaut, sinon celle de la commande d'origine.
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
        commande._id instanceof Types.ObjectId
          ? commande._id.toString()
          : String(commande._id);

      const paymentIntent =
        await this.stripeService.createPaymentIntentWithSavedCard({
          amount,
          customerId: carte.stripeCustomerId,
          paymentMethodId: carte.stripePaymentMethodId,
          orderId: commandeId,
          idempotencyKey: `renew-${id}-${amount}-${abonnement.dateFin}`,
          metadata: { type: 'renew', abonnementId: id },
        });

      if (paymentIntent.status === 'succeeded') {
        this.extendAbonnement(abonnement);
        await commande.save();
        this.analyticsService.track('subscription_renewed', {
          amount: abonnement.price,
          periode: abonnement.periode,
        });
        const email = currentUser?.data?.email;
        if (email) {
          await this.safeSendEmail(
            () =>
              this.sendEmailService.sendRenewalConfirmation(email, {
                periode: abonnement.periode,
                amount: abonnement.price,
                dateFin: abonnement.dateFin,
              }),
            `renew ${id}`,
          );
        }
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
  async confirmRenouvellement(id: string, paymentIntentId: string, currentUser: any) {
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

      this.analyticsService.track('subscription_renewed', {
        amount: abonnement.price,
        periode: abonnement.periode,
      });

      const email = currentUser?.data?.email;
      if (email) {
        await this.safeSendEmail(
          () =>
            this.sendEmailService.sendRenewalConfirmation(email, {
              periode: abonnement.periode,
              amount: abonnement.price,
              dateFin: abonnement.dateFin,
            }),
          `renew-confirm ${id}`,
        );
      }

      return ApiResponse.success('Abonnement renouvelé avec succès', {
        status: 'PAID',
        abonnementId: id,
        abonnement,
      });
    } catch {
      return ApiResponse.error(
        'Erreur lors de la confirmation du renouvellement',
      );
    }
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private extendAbonnement(abonnement: any) {
    const now = new Date();
    const currentEnd = new Date(abonnement.dateFin);
    const base =
      !Number.isNaN(currentEnd.getTime()) && currentEnd > now ? currentEnd : now;
    abonnement.dateFin = this.addPeriod(base, abonnement.periode).toISOString();
    abonnement.statut = StatutAbonnement.ACTIVE;
  }

  private addPeriod(date: Date, periode: PeriodeAbonnement): Date {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      const fallback = new Date();
      periode === PeriodeAbonnement.ANNUEL
        ? fallback.setFullYear(fallback.getFullYear() + 1)
        : fallback.setMonth(fallback.getMonth() + 1);
      return fallback;
    }
    periode === PeriodeAbonnement.ANNUEL
      ? d.setFullYear(d.getFullYear() + 1)
      : d.setMonth(d.getMonth() + 1);
    return d;
  }

  private round2(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private resolveTvaRate(): number {
    const raw = Number(process.env.TVA_RATE);
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) return 0.2;
    return raw;
  }

  private toStripeAmount(amount: number): number {
    return Math.round(Number(amount ?? 0) * 100);
  }

  private async safeSendEmail(action: () => Promise<unknown>, context: string) {
    try {
      await action();
    } catch {
      console.error(`[EMAIL] Echec d'envoi (${context})`);
    }
  }
}
