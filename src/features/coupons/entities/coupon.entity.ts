import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum CouponType {
  PERCENT = 'PERCENT', // value = pourcentage (0-100)
  FIXED = 'FIXED', // value = montant fixe en euros
}

@Schema({ timestamps: true })
export class Coupon extends Document {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ type: String, enum: CouponType, required: true })
  type!: CouponType;

  // Pourcentage (0-100) si PERCENT, montant fixe en euros si FIXED.
  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ default: true })
  active!: boolean;

  // Fenêtre de validité (ISO). Optionnelles.
  @Prop()
  startsAt?: string;

  @Prop()
  endsAt?: string;

  // Nombre maximum d'utilisations (0 = illimité) et compteur d'usage.
  @Prop({ default: 0, min: 0 })
  maxUsage!: number;

  @Prop({ default: 0, min: 0 })
  usedCount!: number;

  // Montant HT minimum de commande pour que le code s'applique (0 = aucun).
  @Prop({ default: 0, min: 0 })
  minAmount!: number;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ code: 1 }, { unique: true });
