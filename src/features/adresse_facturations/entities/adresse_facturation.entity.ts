import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/features/users/entities/user.entity';
@Schema({ timestamps: true })
export class AdresseFacturation extends Document {
  @Prop({ required: true })
  firstName: string;
  @Prop({ required: true })
  lastName: string;
  @Prop({ required: true })
  adresse: string;
  @Prop()
  complementAdresse: string;
  @Prop({ required: true })
  city: string;
  @Prop({ required: true })
  region: string;
  @Prop({ required: true })
  country: string;
  @Prop({ required: true })
  codePostal: string;
  @Prop({ required: true })
  phone: string;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: User;
}

export const AdresseFacturationSchema =
  SchemaFactory.createForClass(AdresseFacturation);
