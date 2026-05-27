import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/features/users/entities/user.entity';

@Schema({ timestamps: true })
export class CarteBancaire extends Document {
  @Prop({ required: true })
  carteName!: string;

  @Prop({ required: true })
  carteNumber!: string;

  @Prop({ required: true })
  carteDate!: string;
  @Prop({ required: true, default: false })
  isDefault!: boolean;

  @Prop({ required: true })
  carteCVV!: string;
  @Prop()
  stripePaymentMethodId?: string;
  @Prop()
  stripeCustomerId?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user!: User;
}
export const CarteBancaireSchema = SchemaFactory.createForClass(CarteBancaire);
