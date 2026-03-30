import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true }) 
export class Slider extends Document {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    image: string;

    @Prop()
    linkUrl: string;

    @Prop()
    NameUrl: string;

    @Prop({ default: 0 })
    order: number;
}

export const SliderSchema = SchemaFactory.createForClass(Slider);