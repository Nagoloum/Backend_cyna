import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Service } from '../../services/entities/service.entity';
import { Image, ImageSchema } from '../../../shared/model/image.entity';

@Schema({ timestamps: true })
export class Product extends Document {
  // FK vers la collection Service

  @Prop({ required: true, trim: true, index: true })
  name!: string;

  @Prop({ required: true, trim: true })
  slug!: string;
  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: [ImageSchema], default: [] })
  images!: Image[];

  @Prop({ type: Number, default: 0, index: true })
  priceMonth!: number;

  @Prop({ type: Number, default: 0 })
  priceYear!: number;

  @Prop({ trim: true, default: '' })
  stripePriceMonthId!: string;

  @Prop({ trim: true, default: '' })
  stripePriceYearId!: string;

  @Prop({ type: Number, default: 0, index: true })
  stock!: number;

  // "Top product" mis en avant sur la home. Nom aligne avec le frontend
  // (badge + toggle admin) et le tri des catalogues, qui utilisent is_selected.
  @Prop({ type: Boolean, default: false })
  is_selected!: boolean;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true, index: true })
  service!: Service;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Index composite pour le listing catalogue (produits d'un service, tries par
// priorite puis ordre d'affichage) + index sur le prix annuel pour les filtres/tri.
ProductSchema.index({ service: 1, is_selected: -1, order: 1 });
ProductSchema.index({ priceYear: 1 });
