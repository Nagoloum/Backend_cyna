import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Service } from 'src/features/services/entities/service.entity';
import { Image, ImageSchema } from 'src/shared/model/image.entity';

@Schema({ timestamps: true })
export class Product extends Document {
  // FK vers la collection Service

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ type: [ImageSchema], default: [] })
  images: Image[];

  @Prop({ type: Number, default: 0 })
  priceMonth: number;

  @Prop({ type: Number, default: 0 })
  priceYear: number;

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: Boolean, default: false })
  is_selected: boolean;

  @Prop({ type: Boolean, default: false })
  priority: boolean;

  @Prop()
  order: number;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service: Service;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
