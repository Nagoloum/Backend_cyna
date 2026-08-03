import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from '../../../shared/common/user-roles.enum';
import { TwoFactorMethod } from '../../../shared/common/two-factor-method.enum';

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

  @Prop({ type: String, enum: UserRoles, required: true, default: UserRoles.CUSTOMER })
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

  // Compte actif. Un compte suspendu (false) par un admin ne peut plus se
  // connecter et ses jetons existants sont refusés par l'AuthGuard.
  @Prop({ default: true })
  isActive!: boolean;

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

  // jti du dernier token de reinitialisation de mot de passe emis. Permet de
  // rendre le lien de reset a usage unique (efface des qu'il est consomme).
  @Prop()
  resetPasswordJti?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
