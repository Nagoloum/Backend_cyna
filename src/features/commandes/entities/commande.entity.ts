import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StatutCommande } from 'src/shared/common/statut-commande.enum';
import {
  Abonnement,
  AbonnementSchema,
} from '../../../shared/model/abonnement.entity';

@Schema({ timestamps: true })
export class Commande extends Document {
  @Prop({ required: true })
  totalPrice: number;
  @Prop({ required: true })
  reference: string;
  @Prop({ required: true })
  nbreProducts: number;
  @Prop({ required: true, enum: StatutCommande })
  statut: StatutCommande;
  @Prop({ type: [AbonnementSchema], default: [] })
  abonnements: Abonnement[];
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CarteBancaire' })
  cb: Types.ObjectId;
}

export const CommandeSchema = SchemaFactory.createForClass(Commande);
