import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StatutCommande } from '../../../shared/common/statut-commande.enum';
import {
  Abonnement,
  AbonnementSchema,
} from '../../../shared/model/abonnement.entity';
import { PeriodeAbonnement } from '../../../shared/common/periode-abonnement.enum';

@Schema({ timestamps: true })
export class Commande extends Document {
  // totalPrice = montant TTC reellement debite (ce que paie le client).
  @Prop({ required: true })
  totalPrice!: number;
  // Decomposition TVA conservee pour la facturation et l'affichage.
  @Prop({ default: 0 })
  totalHT!: number;
  @Prop({ default: 0 })
  tvaRate!: number;
  @Prop({ default: 0 })
  tvaAmount!: number;
  // Promotion appliquee (code + remise en euros sur le HT). 0 si aucune.
  @Prop()
  couponCode?: string;
  @Prop({ default: 0 })
  discountAmount!: number;
  @Prop({ required: true })
  reference!: string;
  @Prop({ required: true })
  nbreProducts!: number;
  @Prop({ required: true, enum: StatutCommande })
  statut!: StatutCommande;
  @Prop({ required: true, enum: PeriodeAbonnement })
  periode!: PeriodeAbonnement;
  @Prop({ type: [AbonnementSchema], default: [] })
  abonnements!: Abonnement[];
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CarteBancaire' })
  cb!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'AdresseFacturation' })
  addresseFacturation!: Types.ObjectId;
}

export const CommandeSchema = SchemaFactory.createForClass(Commande);

// Index pour les requetes frequentes : historique par utilisateur (trie par
// date), filtres par statut et recherche par reference. Evite les collection
// scans qui degradent les perfs des que le volume de commandes augmente.
CommandeSchema.index({ user: 1, createdAt: -1 });
CommandeSchema.index({ statut: 1 });
CommandeSchema.index({ reference: 1 });
