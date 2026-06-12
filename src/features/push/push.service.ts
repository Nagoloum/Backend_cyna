import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Service de notifications push Web (VAPID).
 *
 * Gated sur les variables d'environnement VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * et VAPID_EMAIL. Sans ces vars, toutes les méthodes sont des no-ops silencieux :
 * aucune erreur levée, aucun effet en développement / preview.
 *
 * Génération des clés : `node scripts/generate-vapid.js`
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly subModel: Model<PushSubscription>,
  ) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL;

    if (pub && priv && email) {
      webpush.setVapidDetails(email, pub, priv);
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  // Enregistre (ou met à jour) la souscription d'un appareil.
  async subscribe(
    dto: { endpoint: string; keys: { p256dh: string; auth: string } },
    userId: string,
  ): Promise<void> {
    await this.subModel.findOneAndUpdate(
      { endpoint: dto.endpoint },
      {
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        user: new Types.ObjectId(userId),
      },
      { upsert: true, new: true },
    );
  }

  // Supprime la souscription d'un appareil.
  async unsubscribe(endpoint: string, userId: string): Promise<void> {
    await this.subModel.deleteOne({
      endpoint,
      user: new Types.ObjectId(userId),
    });
  }

  // Envoie une notification à tous les appareils d'un utilisateur.
  // Les souscriptions expirées (410 Gone) sont purgées automatiquement.
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.subModel.find({ user: new Types.ObjectId(userId) });
    await Promise.all(subs.map((sub) => this.sendOne(sub, payload)));
  }

  // Diffuse une notification à tous les abonnés (usage admin).
  async sendToAll(payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.subModel.find({});
    await Promise.all(subs.map((sub) => this.sendOne(sub, payload)));
  }

  private async sendOne(sub: PushSubscription, payload: PushPayload): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err: any) {
      // 410 Gone ou 404 = souscription invalide → on la supprime.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await this.subModel.deleteOne({ _id: sub._id }).catch(() => {});
      } else {
        this.logger.warn(`Push échoué (${sub.endpoint.slice(-20)}): ${err?.message}`);
      }
    }
  }
}
