// stripe.service.ts
import Stripe = require('stripe');
import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';

config();
type CheckoutItem = {
  stripePriceId: string;
  quantity?: number;
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe.Stripe;

  constructor() {
    this.stripe = Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  async createCheckoutSession(items: CheckoutItem[], orderId: string) {
    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item) => ({
        price: item.stripePriceId,
        quantity: item.quantity ?? 1,
      })),
      mode: 'subscription',
      success_url: `http://localhost:3000/success?id=${orderId}`,
      cancel_url: `http://localhost:3000/cancel`,
      metadata: { orderId },
    });
  }
}
