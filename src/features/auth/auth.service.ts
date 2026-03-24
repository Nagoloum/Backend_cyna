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

config();

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

      if (!user) {
        return ApiResponse.error(
          "Vous n'avez pas de compte sur notre plateforme, veuillez vous inscrire",
        );
      }

      const matchPassword = await bcrypt.compare(
        loginDto.password,
        user.password,
      );

      if (!matchPassword) {
        return ApiResponse.error('Votre mot de passe est incorrect');
      }

      // On ne bloque plus la connexion si !user.confirmed
      // On renvoie juste l'info dans la réponse

      const token = this.sharedService.accessToken(user);
      return ApiResponse.success('Connexion réussie', {
        token,
        user,
      });
    } catch (error: any) {
      return ApiResponse.error('Une erreur est survenue lors de la connexion ');
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
        'Inscription réussie, vérifiez votre email pour confirmer votre compte',
      );
    } catch (error: any) {
      // ← Ajoute ça
      return ApiResponse.error(
        'Une erreur est survenue lors de la connexion' + error.message,
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
  async forgotPassword(currentEmail) {
    try {
      // une fois que j'ai email je verife s'il existe.
      const currentUser = await this.userModel.findOne(
        { email: currentEmail },
        'email',
      );
      // Si l'utilisateur n'existe pas j'envoie un message d'erreur
      if (!currentUser) {
        return ApiResponse.error(
          'Nous n’avons trouvé aucun compte associé à cette adresse e-mail.',
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
      console.error('Erreur login:', error); // ← Ajoute ça
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
