import { Prop, Schema } from '@nestjs/mongoose';

// Définition du sous-document Address
@Schema({ _id: false }) // _id: false pour ne pas créer un id pour l'adresse
export class Address {
  @Prop()
  country: string;

  @Prop()
  state: string;

  @Prop()
  city: string;

  @Prop()
  postalCode: string;
}
