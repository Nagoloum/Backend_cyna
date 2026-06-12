import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Journal d'audit : trace les actions sensibles (connexion, changements de mot
// de passe / 2FA, suspension de compte, changement de statut de commande…).
// En lecture seule via l'API (aucune route de modification/suppression).
@Schema({ timestamps: true })
export class AuditLog extends Document {
  // Identifiant d'action, ex. 'user.login', 'user.suspended', 'order.status_changed'.
  @Prop({ required: true, index: true })
  action!: string;

  // Auteur de l'action (peut être absent : ex. tentative anonyme).
  @Prop()
  actorId?: string;

  @Prop()
  actorEmail?: string;

  // Ressource ciblée, ex. targetType='user', targetId=<id>.
  @Prop()
  targetType?: string;

  @Prop()
  targetId?: string;

  // Contexte additionnel non sensible (ex. ancien/nouveau statut).
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Listing par date décroissante : index sur createdAt.
AuditLogSchema.index({ createdAt: -1 });
