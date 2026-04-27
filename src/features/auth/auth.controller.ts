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
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { User } from '../users/entities/user.entity';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { NoFilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth/')
@ApiConsumes('multipart/form-data')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseInterceptors(NoFilesInterceptor())
  login(@Body(FormDataTransformPipe, ValidationPipe) loginDto: LoginDto) {
    console.log(loginDto);
    return this.authService.login(loginDto);
  }
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
    console.log('Vérification du code reçu :', code);
    return this.authService.verifyCode2FA(code);
  }
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
