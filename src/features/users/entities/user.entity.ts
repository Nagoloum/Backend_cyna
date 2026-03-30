import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from 'src/shared/common/user-roles.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop()
  firstName: string;
  @Prop()
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, default: UserRoles.CUSTOMER })
  role: UserRoles;
  @Prop(
    raw({
      code: { type: String, default: '' },
      dateExp: { type: String, default: '' },
    }),
  )
  verification: Record<string, any>;
  @Prop()
  phone: string;

  @Prop({ default: false })
  confirmed: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
