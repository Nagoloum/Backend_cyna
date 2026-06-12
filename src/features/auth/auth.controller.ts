import {
  Controller,
  Post,
  Body,
  Query,
  Get,
  UseGuards,
  ValidationPipe,
  UseInterceptors,
  Res,
} from '@nestjs/common';
// import type évite l'erreur TS1272 (isolatedModules + emitDecoratorMetadata) :
// le type n'est pas émis dans les métadonnées des décorateurs.
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorators';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { Allow2FAPending } from '../../shared/decorators/allow-2fa-pending.decorator';
import { User } from '../users/entities/user.entity';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiResponse } from '../../shared/responses/api-response';

// Durée de vie du cookie JWT (7 jours, en ms).
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Pose le cookie httpOnly accessToken sur la réponse. */
function setAuthCookie(res: any, token: string): void {
  const prod = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: prod,
    // cynaapi.vercel.app et cynaapp.vercel.app sont cross-site (vercel.app est
    // dans la Public Suffix List). SameSite=None;Secure est requis pour que le
    // cookie httpOnly traverse les requêtes cross-site en production.
    sameSite: prod ? 'none' : 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Supprime le cookie accessToken côté serveur. */
function clearAuthCookie(res: any): void {
  const prod = process.env.NODE_ENV === 'production';
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'strict',
    path: '/',
  });
}

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth/')
@ApiConsumes('multipart/form-data')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Anti brute-force : 5 tentatives de connexion par minute et par IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @UseInterceptors(NoFilesInterceptor())
  async login(
    @Body(FormDataTransformPipe, ValidationPipe) loginDto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.login(loginDto);
    const token = (result?.data as any)?.token;
    if (result?.success && token) {
      setAuthCookie(res, token);
    }
    return result;
  }

  // Anti brute-force du code 2FA (6 chiffres) : 5 essais/minute.
  // Jeton pre-auth requis (identifie l'utilisateur) + autorise malgre le
  // flag twoFactorPending via @Allow2FAPending.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AuthGuard)
  @Allow2FAPending()
  @Post('check-code')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: '123456',
          description: 'Le code à 6 chiffres reçu par email',
          minLength: 6,
          maxLength: 6,
        },
      },
      required: ['code'],
    },
  })
  async verify2FA(
    @Body('code') code: string,
    @CurrentUser() currentUser: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.verifyCode2FA(code, currentUser);
    const token = (result?.data as any)?.token;
    if (result?.success && token) {
      setAuthCookie(res, token);
    }
    return result;
  }

  // ── 2FA management (utilisateur connecté) ──
  @UseGuards(AuthGuard)
  @Post('2fa/totp/init')
  setupTotp(@CurrentUser() currentUser: any) {
    return this.authService.setupTotp(currentUser);
  }

  @UseGuards(AuthGuard)
  @Post('2fa/totp/activate')
  activateTotp(@Body('code') code: string, @CurrentUser() currentUser: any) {
    return this.authService.activateTotp(code, currentUser);
  }

  @UseGuards(AuthGuard)
  @Post('2fa/email/activate')
  activateEmail2FA(@CurrentUser() currentUser: any) {
    return this.authService.activateEmail2FA(currentUser);
  }

  @UseGuards(AuthGuard)
  @Post('2fa/disable')
  disable2FA(
    @Body('password') password: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.disable2FA(password, currentUser);
  }

  // Étape 2FA de connexion pour la méthode TOTP (jeton pre-auth accepte ici).
  @UseGuards(AuthGuard)
  @Allow2FAPending()
  @Post('2fa/totp/verify')
  async verifyTotpLogin(
    @Body('code') code: string,
    @CurrentUser() currentUser: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.verifyTotpLogin(code, currentUser);
    const token = (result?.data as any)?.token;
    if (result?.success && token) {
      setAuthCookie(res, token);
    }
    return result;
  }

  // Déconnexion côté serveur : efface le cookie httpOnly (inaccessible au JS).
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return ApiResponse.success('Déconnecté avec succès');
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @UseInterceptors(NoFilesInterceptor())
  register(
    @Body(FormDataTransformPipe, ValidationPipe) registerDto: RegisterDto,
  ) {
    return this.authService.register(registerDto);
  }

  @Get('email-confirmation')
  emailConfirmation(@Query('token') token: string) {
    return this.authService.emailConfirmation(token);
  }

  @UseGuards(AuthGuard)
  @Get('user/me')
  getProfileUser(@CurrentUser() currentUser: User) {
    return currentUser;
  }

  // reset de mot de passe de l'utlisateur
  // Anti email-bombing : 3 demandes de reset par minute et par IP.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    },
  })
  @UseInterceptors(NoFilesInterceptor())
  resetforgotPassword(
    @Body(FormDataTransformPipe, ValidationPipe) email: string,
  ) {
    return this.authService.forgotPassword(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        password: { type: 'string', example: 'NewPassword@123' },
      },
      required: ['password'],
    },
  })
  @UseInterceptors(NoFilesInterceptor())
  changePassword(
    @Query('token') token: string,
    @Body(FormDataTransformPipe, ValidationPipe) password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
