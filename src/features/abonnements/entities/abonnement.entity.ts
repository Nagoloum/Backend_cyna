import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Commande } from 'src/features/commandes/entities/commande.entity';
import { Product } from 'src/features/products/entities/product.entity';
import { User } from 'src/features/users/entities/user.entity';
import { PeriodeAbonnement } from 'src/shared/common/periode-abonnement.enum';
import { StatutAbonnement } from 'src/shared/common/statut-abonnement.enum';

@Schema({ timestamps: true })
export class Abonnement extends Document {
  @Prop({ required: true })
  dateFin: string;
  @Prop({ required: true })
  dateDebut: string;
  @Prop({ required: true })
  quantity: number;
  @Prop({
    required: true,
    enum: PeriodeAbonnement,
    default: PeriodeAbonnement.MENSUEL,
  })
  periode: PeriodeAbonnement;

  @Prop({ required: true })
  price: number;
  @Prop({
    required: true,
    enum: StatutAbonnement,
    default: StatutAbonnement.ACTIVE,
  })
  statut: StatutAbonnement;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: User;
  @Prop({ type: Types.ObjectId, ref: 'Commande' })
  commande: Commande;
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product: Product;
}

export const AbonnementSchema = SchemaFactory.createForClass(Abonnement);
