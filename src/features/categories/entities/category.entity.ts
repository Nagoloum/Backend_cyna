import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true })
  name!: string;
  @Prop({ required: true, unique: true })
  slug!: string;
  @Prop()
  image!: string;
  @Prop()
  description!: string;
  @Prop({ required: true })
  order!: number;
}
export const CategorySchema = SchemaFactory.createForClass(Category);

// Les categories sont quasi systematiquement listees triees par ordre d'affichage.
CategorySchema.index({ order: 1 });
