import { Controller, Post, Body, Query, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller('auth/')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
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
  resetforgotPassword(@Body('email') email: string) {
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
  changePassword(
    @Query('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
