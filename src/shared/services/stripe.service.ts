// stripe.service.ts
import Stripe = require('stripe');
import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';

config();
type CheckoutItem = {
  quantity?: number;
  stripePriceId?: string;
  productName?: string;
  unitAmount?: number;
  interval?: 'month' | 'year';
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe.Stripe;
  private readonly appBaseUrl: string;

  constructor() {
    this.stripe = Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-03-25.dahlia',
    });
    this.appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  }

  async createCheckoutSession(items: CheckoutItem[], orderId: string) {
    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item) => {
        if (item.stripePriceId?.startsWith('price_')) {
          return {
            price: item.stripePriceId,
            quantity: item.quantity ?? 1,
          };
        }

        if (!item.productName || !item.unitAmount || !item.interval) {
          throw new Error(
            'Chaque article Stripe doit avoir un priceId valide ou un price_data complet',
          );
        }

        return {
          price_data: {
            currency: 'eur',
            product_data: {
              name: item.productName,
            },
            unit_amount: item.unitAmount,
            recurring: {
              interval: item.interval,
            },
          },
          quantity: item.quantity ?? 1,
        };
      }),
      mode: 'subscription',
      success_url: `${this.appBaseUrl}/api/commandes/payment/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appBaseUrl}/api/commandes/payment/cancel?orderId=${orderId}`,
      metadata: { orderId },
    });
  }

  async retrieveCheckoutSession(sessionId: string) {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  constructEvent(payload: Buffer | string, signature?: string | string[]) {
    if (!signature || Array.isArray(signature)) {
      throw new Error('Signature Stripe manquante ou invalide');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  }
}
