import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Contact extends Document {
    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    subject: string;

    @Prop({ required: true })
    message: string;
}
export const ContactSchema = SchemaFactory.createForClass(Contact);