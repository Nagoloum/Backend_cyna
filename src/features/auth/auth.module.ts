import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SharedService } from 'src/shared/services/shared.service';
import { JwtService } from '@nestjs/jwt';
import { SendEmailService } from 'src/shared/services/sendemail.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SharedService, JwtService, SendEmailService],
})
export class AuthModule {}
