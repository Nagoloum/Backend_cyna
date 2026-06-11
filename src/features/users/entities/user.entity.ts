import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { TwoFactorMethod } from 'src/shared/common/two-factor-method.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop()
  firstName!: string;
  @Prop()
  lastName!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true, default: UserRoles.CUSTOMER })
  role!: UserRoles;
  @Prop(
    raw({
      code: { type: String, default: '' },
      dateExp: { type: String, default: '' },
    }),
  )
  verification!: Record<string, any>;
  @Prop()
  phone!: string;

  @Prop()
  stripeCustomerId?: string;

  @Prop({ default: false })
  confirmed!: boolean;

  // ── Two-factor authentication ──
  @Prop({
    type: String,
    enum: TwoFactorMethod,
    default: TwoFactorMethod.NONE,
  })
  twoFactorMethod!: TwoFactorMethod;

  // TOTP shared secret (base32). Never exposed via the API.
  @Prop()
  twoFactorSecret?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
