import { ConsoleLogger, Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/entities/user.entity';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import * as bcrypt from 'bcrypt';
import { SharedService } from 'src/shared/services/shared.service';
import { SendEmailService } from 'src/shared/services/sendemail.service';
import { JwtService } from '@nestjs/jwt';
import { config } from 'dotenv';
import { StringValue } from 'ms';
import { Console } from 'console';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { console } from 'inspector/promises';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { TwoFactorMethod } from 'src/shared/common/two-factor-method.enum';

config();

// Tolère ±30s de décalage d'horloge entre le serveur et l'appareil.
authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly sharedService: SharedService,
    private readonly sendEmailService: SendEmailService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const user = await this.userModel
        .findOne({ email: loginDto.email })
        .exec();

      // Message identique que le compte existe ou non : empêche
      // l'énumération des adresses e-mail inscrites.
      if (!user) {
        return ApiResponse.error('Adresse e-mail ou mot de passe incorrect');
      }

      const matchPassword = await bcrypt.compare(
        loginDto.password,
        user.password,
      );

      if (!matchPassword) {
        return ApiResponse.error('Adresse e-mail ou mot de passe incorrect');
      }
      // 2FA par utilisateur. Pour la méthode EMAIL on envoie un code à 6 chiffres.
      // Pour TOTP (Google Authenticator) l'utilisateur a déjà son code dans l'app.
      const twoFactorMethod = user.twoFactorMethod ?? TwoFactorMethod.NONE;
      if (twoFactorMethod === TwoFactorMethod.EMAIL) {
        const code = this.sharedService.generateSixDigitCode();
        await this.userModel.findOneAndUpdate(
          { email: user.email },
          {
            verification: {
              code,
              dateExp: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            },
          },
        );
        await this.sendEmailService.sendVerificationCode(user.email, code);
      }
      const token = this.sharedService.accessToken(user);
      return ApiResponse.success('Connexion réussie', {
        token,
        role: user.role,
        twoFactorMethod,
      });
    } catch (error: any) {
      return ApiResponse.error(
        'Une erreur est survenue lors de la connexion',
      );
    }
  }
  verifyCode2FA(inputCode: string) {
    if (!inputCode) {
      return ApiResponse.error('Code de confirmation requis');
    }
    const isValid = this.sharedService.verifyCode(inputCode);

    if (!isValid) {
      return ApiResponse.error('Code de confirmation incorrect ou expiré');
    }
    return ApiResponse.success('Code validé avec succès');
  }

  // ── 2FA management (settings) ───────────────────────────────────────────────

  // Génère un secret TOTP + un QR code à scanner dans Google Authenticator.
  // Le secret n'est appliqué qu'après vérification d'un code (activateTotp).
  async setupTotp(currentUser: any) {
    try {
      const user = await this.userModel.findById(currentUser?.data?._id);
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      const secret = authenticator.generateSecret();
      user.twoFactorSecret = secret;
      await user.save();

      const otpauthUrl = authenticator.keyuri(user.email, 'Cyna', secret);
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

      return ApiResponse.success('Secret 2FA généré', {
        otpauthUrl,
        qrDataUrl,
        secret,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la génération du secret 2FA');
    }
  }

  // Vérifie un code de l'app d'authentification puis active la méthode TOTP.
  async activateTotp(code: string, currentUser: any) {
    try {
      const user = await this.userModel.findById(currentUser?.data?._id);
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      if (!user.twoFactorSecret) {
        return ApiResponse.error(
          'Aucun secret 2FA trouvé. Relancez la configuration.',
        );
      }
      const isValid = authenticator.verify({
        token: String(code ?? '').trim(),
        secret: user.twoFactorSecret,
      });
      if (!isValid) {
        return ApiResponse.error(
          "Code incorrect. Vérifiez votre application d'authentification.",
        );
      }
      user.twoFactorMethod = TwoFactorMethod.TOTP;
      await user.save();
      return ApiResponse.success(
        'Google Authenticator activé avec succès',
        { twoFactorMethod: TwoFactorMethod.TOTP },
      );
    } catch (error) {
      return ApiResponse.error("Erreur lors de l'activation du 2FA");
    }
  }

  // Active le 2FA par email (code envoyé à la connexion).
  async activateEmail2FA(currentUser: any) {
    try {
      const user = await this.userModel.findById(currentUser?.data?._id);
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      user.twoFactorMethod = TwoFactorMethod.EMAIL;
      user.twoFactorSecret = undefined;
      await user.save();
      return ApiResponse.success('2FA par email activé avec succès', {
        twoFactorMethod: TwoFactorMethod.EMAIL,
      });
    } catch (error) {
      return ApiResponse.error("Erreur lors de l'activation du 2FA email");
    }
  }

  // Désactive le 2FA (mot de passe requis).
  async disable2FA(password: string, currentUser: any) {
    try {
      const user = await this.userModel.findById(currentUser?.data?._id);
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      const ok = await bcrypt.compare(password ?? '', user.password);
      if (!ok) {
        return ApiResponse.error('Mot de passe incorrect');
      }
      user.twoFactorMethod = TwoFactorMethod.NONE;
      user.twoFactorSecret = undefined;
      await user.save();
      return ApiResponse.success('2FA désactivé avec succès', {
        twoFactorMethod: TwoFactorMethod.NONE,
      });
    } catch (error) {
      return ApiResponse.error('Erreur lors de la désactivation du 2FA');
    }
  }

  // Vérifie un code TOTP lors de l'étape 2FA de connexion (utilisateur déjà loggé).
  async verifyTotpLogin(code: string, currentUser: any) {
    try {
      const user = await this.userModel.findById(currentUser?.data?._id);
      if (!user?.twoFactorSecret) {
        return ApiResponse.error("L'authentification à deux facteurs n'est pas configurée");
      }
      const isValid = authenticator.verify({
        token: String(code ?? '').trim(),
        secret: user.twoFactorSecret,
      });
      if (!isValid) {
        return ApiResponse.error('Code incorrect ou expiré');
      }
      return ApiResponse.success('Code validé avec succès');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la vérification du code');
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      const user = await this.userModel
        .findOne({ email: registerDto.email })
        .exec();

      if (user) {
        return ApiResponse.error(
          'Cet email est déjà utilisé, veuillez vous connecter',
        );
      }

      if (!this.sharedService.isStrongPassword(registerDto.password)) {
        return ApiResponse.error(
          'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
        );
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      const newUser = new this.userModel({
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        email: registerDto.email,
        password: hashedPassword,
        confirmed: false,
      });

      const savedUser = await newUser.save();

      const tokenConfirmedEmail =
        this.sharedService.tokenConfirmedEmail(savedUser);

      await this.sendEmailService.confirmedEmail(
        registerDto.email,
        tokenConfirmedEmail,
      );

      return ApiResponse.success(
        'Inscription réussie, vérifiez votre email pour confirmer votre compte puis vous connecter',
      );
    } catch (error: any) {
      // ← Ajoute ça
      return ApiResponse.error(
        'Une erreur est survenue lors de la connexion',
      );
    }
  }

  async emailConfirmation(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.ACCESS_TOKEN_SECRET_KEY,
      });

      const user = await this.userModel
        .findOneAndUpdate(
          { email: payload.email },
          { confirmed: true },
          { new: true },
        )
        .exec();

      if (!user) {
        return ApiResponse.error('Ce lien de confirmation est invalide');
      }

      return ApiResponse.success(
        'Email confirmé, vous pouvez maintenant vous connecter',
      );
    } catch (error: any) {
      return ApiResponse.error(
        'Une erreur est survenue lors de la confirmation',
      );
    }
  }
  async forgotPassword(currentEmail: string) {
    try {
      // une fois que j'ai email je verife s'il existe.
      const currentUser = await this.userModel.findOne(
        { email: currentEmail },
        'email',
      );
      // Réponse identique que le compte existe ou non : empêche
      // l'énumération des adresses e-mail inscrites.
      if (!currentUser) {
        return ApiResponse.success(
          'Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé.',
        );
      }
      //Si l'utilisateur existe je l'envoie un mail de reset de password avec un token
      const createTokenForget =
        this.sharedService.tokenConfirmedEmail(currentUser); // création d'un tokebn
      await this.sendEmailService.sendResetPassword(
        currentUser.email,
        createTokenForget,
      ); // envoie du message de rest password
      return ApiResponse.success(
        'Veuillez vérifier votre adresse e-mail afin de finaliser l’opération.',
      );
    } catch (error: any) {
      console.error('[AUTH] Echec de la demande de reinitialisation');
      return ApiResponse.error('Une erreur est survenue lors de la connexion');
    }
  }
  async resetPassword(token: string, newPassword: string) {
    try {
      // Vérification et décodage du token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.ACCESS_TOKEN_SECRET_KEY,
      });

      // Récupération de l’email depuis le token
      const currentEmail = payload.email;

      // Récupération de l’utilisateur
      const user = await this.userModel.findOne({ email: currentEmail });
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable.');
      }
      // Vérification des règles du mot de passe
      if (!this.sharedService.isStrongPassword(newPassword)) {
        return ApiResponse.error(
          'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
        );
      }

      // Hachage du mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Enregistrement du nouveau mot de passe
      user.password = hashedPassword;
      await user.save();
      return ApiResponse.success('Mot de passe réinitialisé avec succès.');
    } catch (error) {
      return ApiResponse.error(
        'Token invalide ou expiré. Veuillez vérifier votre token.',
      );
    }
  }
}
