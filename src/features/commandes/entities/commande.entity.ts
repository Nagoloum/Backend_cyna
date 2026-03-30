import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CarteBancaire } from 'src/features/carte_bancaires/entities/carte_bancaire.entity';
import { User } from 'src/features/users/entities/user.entity';
import { StatutCommande } from 'src/shared/common/statut-commande.enum';

export class Commande extends Document {
  @Prop({ required: true })
  totalPrice: number;
  @Prop({ required: true })
  reference: string;
  @Prop({ required: true })
  nbreProducts: number;
  @Prop({ required: true, enum: StatutCommande })
  statut: StatutCommande;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: User;
  @Prop({ type: Types.ObjectId, ref: 'CarteBancaire' })
  cb: CarteBancaire;
}

export const CommandeSchema = SchemaFactory.createForClass(Commande);
