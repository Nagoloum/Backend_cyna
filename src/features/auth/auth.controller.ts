import {
  Controller,
  Post,
  Body,
  Query,
  Get,
  UseGuards,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorators';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { User } from '../users/entities/user.entity';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

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
  login(@Body(FormDataTransformPipe, ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  // Anti brute-force du code 2FA (6 chiffres) : 5 essais/minute.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  verify2FA(@Body('code') code: string) {
    return this.authService.verifyCode2FA(code);
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

  // Étape 2FA de connexion pour la méthode TOTP (l'utilisateur a déjà un token).
  @UseGuards(AuthGuard)
  @Post('2fa/totp/verify')
  verifyTotpLogin(@Body('code') code: string, @CurrentUser() currentUser: any) {
    return this.authService.verifyTotpLogin(code, currentUser);
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
