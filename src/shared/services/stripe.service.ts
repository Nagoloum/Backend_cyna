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

type SavedCardPaymentInput = {
  amount: number;
  currency?: string;
  customerId: string;
  paymentMethodId: string;
  orderId: string;
};

type CreateCustomerInput = {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
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

  async createCustomer({ email, name, metadata }: CreateCustomerInput) {
    return await this.stripe.customers.create({
      email,
      name,
      metadata,
    });
  }

  async retrieveCustomer(customerId: string) {
    return await this.stripe.customers.retrieve(customerId);
  }

  async retrievePaymentMethod(paymentMethodId: string) {
    return await this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  async attachPaymentMethodToCustomer(
    paymentMethodId: string,
    customerId: string,
  ) {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async updateDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ) {
    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async createSetupIntent(customerId: string) {
    return await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
  }

  async createPaymentIntentWithSavedCard({
    amount,
    currency = 'eur',
    customerId,
    paymentMethodId,
    orderId,
  }: SavedCardPaymentInput) {
    return await this.stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        payment_method_types: ['card'],
        confirm: true,
        metadata: { orderId },
      },
      {
        idempotencyKey: `order-payment-${orderId}`,
      },
    );
  }

  async retrievePaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
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
