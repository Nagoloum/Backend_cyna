import {
  Controller,
  Post,
  Body,
  Query,
  Get,
  Req,
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

// Durée de vie des cookies (access aligné sur l'access token court ~1h ; refresh 30j).
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 1000; // 1h
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30j

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
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Pose le cookie httpOnly refreshToken (longue durée). */
function setRefreshCookie(res: any, token: string): void {
  const prod = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Supprime les cookies d'authentification côté serveur. */
function clearAuthCookie(res: any): void {
  const prod = process.env.NODE_ENV === 'production';
  const opts = {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? ('none' as const) : ('strict' as const),
    path: '/',
  };
  res.clearCookie('accessToken', opts);
  res.clearCookie('refreshToken', opts);
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
    this.applyAuthCookies(res, result);
    return result;
  }

  // Factorise la pose des cookies (access + refresh) a partir du resultat d'un
  // flux d'authentification, et retire le refresh token du corps de reponse
  // (il ne doit exister que dans le cookie httpOnly, jamais accessible au JS).
  private applyAuthCookies(res: any, result: any): void {
    const data = result?.data as any;
    if (result?.success && data?.token && !data?.twoFactorPending) {
      setAuthCookie(res, data.token);
    }
    if (result?.success && data?.refreshToken) {
      setRefreshCookie(res, data.refreshToken);
      delete data.refreshToken;
    }
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
    this.applyAuthCookies(res, result);
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
    this.applyAuthCookies(res, result);
    return result;
  }

  // Renouvellement de session : echange le refresh token (cookie httpOnly) contre
  // un nouvel access token. Public (pas d'access token requis, il est peut-etre
  // expire). Le refresh token n'est jamais renvoye dans le corps.
  @Post('refresh')
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const refreshToken = req?.cookies?.refreshToken;
    const result = await this.authService.refreshAccessToken(refreshToken);
    this.applyAuthCookies(res, result);
    return result;
  }

  // Déconnexion côté serveur : révoque les refresh tokens (incrémente
  // tokenVersion) et efface les cookies httpOnly (inaccessibles au JS).
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutByRefreshToken(req?.cookies?.refreshToken);
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
    @Body(FormDataTransformPipe, ValidationPipe) body: { email: string } | string,
  ) {
    const email = typeof body === 'string' ? body : body?.email;
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
    @Body(FormDataTransformPipe, ValidationPipe) body: { password: string } | string,
  ) {
    const password = typeof body === 'string' ? body : body?.password;
    return this.authService.resetPassword(token, password);
  }
}
