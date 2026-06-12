import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

export enum StatutContact {
  NEW = 'NEW',
  READ = 'READ',
  REPLIED = 'REPLIED',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class Contact extends Document {
    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    subject: string;

    @Prop({ required: true })
    message: string;

    // Suivi du ticket : statut + réponse de l'équipe support.
    @Prop({ type: String, enum: StatutContact, default: StatutContact.NEW })
    status: StatutContact;

    @Prop()
    reply?: string;

    @Prop()
    repliedAt?: string;
}
export const ContactSchema = SchemaFactory.createForClass(Contact);
