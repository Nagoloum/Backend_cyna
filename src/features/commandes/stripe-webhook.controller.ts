import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { StripeService } from '../../shared/services/stripe.service';
import { CommandesService } from './commandes.service';

// Endpoint webhook Stripe : source de verite cote serveur pour l'etat des
// paiements. Indispensable car la confirmation cote navigateur peut ne jamais
// arriver (onglet ferme, perte reseau apres un debit reussi). Route publique
// (Stripe n'envoie pas de JWT) mais protegee par la verification de signature.
@ApiExcludeController()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger('StripeWebhook');

  constructor(
    private readonly stripeService: StripeService,
    private readonly commandesService: CommandesService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      // Sans secret configure, impossible de verifier l'authenticite : on
      // refuse de traiter l'evenement plutot que de faire confiance aveuglement.
      this.logger.error('STRIPE_WEBHOOK_SECRET manquant : webhook ignore');
      throw new BadRequestException('Webhook Stripe non configuré');
    }

    // La verification de signature exige le corps BRUT (rawBody active dans
    // main.ts). Toute alteration du payload invalide la signature.
    let event: ReturnType<StripeService['constructEvent']>;
    try {
      event = this.stripeService.constructEvent(
        req.rawBody as Buffer,
        signature,
      );
    } catch (err: any) {
      this.logger.warn(`Signature webhook invalide: ${err?.message}`);
      throw new BadRequestException('Signature Stripe invalide');
    }

    // Le traitement metier ne doit jamais renvoyer une erreur a Stripe pour un
    // evenement bien signe : on accuse reception (200) et on logue les soucis,
    // sinon Stripe rejoue l'evenement en boucle.
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const intent = event.data.object as { metadata?: { orderId?: string } };
          const orderId = intent?.metadata?.orderId;
          if (orderId) {
            // Idempotent : markAsPaid peut etre rejoue sans effet de bord.
            await this.commandesService.markAsPaid(orderId);
            this.logger.log(`Commande ${orderId} marquée PAID via webhook`);
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const intent = event.data.object as { metadata?: { orderId?: string } };
          this.logger.warn(
            `Echec de paiement signale pour la commande ${intent?.metadata?.orderId ?? 'inconnue'}`,
          );
          break;
        }
        default:
          // Evenements non geres : acceptes silencieusement.
          break;
      }
    } catch (err: any) {
      this.logger.error(
        `Erreur de traitement du webhook ${event.type}`,
        err?.stack,
      );
    }

    return { received: true };
  }
}
