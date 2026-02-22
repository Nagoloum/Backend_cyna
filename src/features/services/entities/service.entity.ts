import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Category } from 'src/features/categories/entities/category.entity';

@Schema({ timestamps: true })
export class Service extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  TechFile: string;

  @Prop({ default: true })
  available: boolean;
  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
