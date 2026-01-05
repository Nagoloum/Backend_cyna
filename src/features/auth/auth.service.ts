import { Injectable } from '@nestjs/common';
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
      let matchPassword = false;
      const user = await this.userModel
        .findOne({ email: loginDto.email })
        .exec();

      if (!user) {
        return ApiResponse.error(
          "Vous n'avez pas de compte sur notre plateforme, veuillez vous inscrire",
        );
      }

      matchPassword = await bcrypt.compare(loginDto?.password, user?.password);

      if (!matchPassword) {
        return ApiResponse.error('Votre mot de passe est incorrect');
      }
      if (!user.confirmed) {
        return ApiResponse.error(
          'Veuillez vérifier votre boîte e-mail pour confirmer votre compte ou à contacter le support en cas de problème.',
        );
      }
      const accessToken = this.sharedService.accessToken(user);
      return ApiResponse.success('connexion réussie', accessToken);
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
      const newUser = new this.userModel({
        ...registerDto,
        password: await bcrypt.hash(registerDto.password, 10),
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
      return ApiResponse.error('Une erreur est survenue lors de la connexion ');
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

      return ApiResponse.success('Email confirmé, vous pouvez vous connecter');
    } catch (error: any) {
      return ApiResponse.error('Une erreur est survenue lors de la connexion ');
    }
  }
}
