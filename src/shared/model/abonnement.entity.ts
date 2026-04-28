import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PeriodeAbonnement } from '../common/periode-abonnement.enum';
import { StatutAbonnement } from '../common/statut-abonnement.enum';
@Schema({ _id: true }) // facultatif, _id est true par défaut
export class Abonnement extends Document {
  @Prop({ required: true })
  dateFin!: string;
  @Prop({ required: true })
  dateDebut!: string;
  @Prop({ required: true })
  quantity!: number;
  @Prop({ required: true })
  keyLicence!: string;
  @Prop({
    required: true,
    enum: PeriodeAbonnement,
    default: PeriodeAbonnement.MENSUEL,
  })
  periode!: PeriodeAbonnement;
  @Prop({ required: true })
  price!: number;
  @Prop({
    required: true,
    enum: StatutAbonnement,
    default: StatutAbonnement.ACTIVE,
  })
  statut!: StatutAbonnement;
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product!: Types.ObjectId;
}
export const AbonnementSchema = SchemaFactory.createForClass(Abonnement);
