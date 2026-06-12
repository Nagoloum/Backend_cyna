import {
  CanActivate,
  ExecutionContext,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { config } from 'dotenv';
import { Request } from 'express';

import { UsersService } from '../../features/users/users.service';
import { ALLOW_2FA_PENDING } from '../decorators/allow-2fa-pending.decorator';

config();
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    private jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.ACCESS_TOKEN_SECRET_KEY,
      });

      const currentUser = await this.userService.findOne(payload.id);
      request['currentUser'] = currentUser;

      // Compte suspendu : on rejette meme un jeton encore valide, ce qui
      // deconnecte immediatement un utilisateur suspendu en cours de session.
      if ((currentUser as any)?.data?.isActive === false) {
        throw new UnauthorizedException('Votre compte a été suspendu');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(
        'Votre session a expiré, veuillez vous reconnecter',
      );
    }

    // Un jeton "pre-auth" 2FA n'est accepte que sur les routes explicitement
    // marquees @Allow2FAPending (etape de verification du code). Partout
    // ailleurs il est refuse : impossible de contourner le second facteur.
    if (payload?.twoFactorPending) {
      const allowPending = this.reflector.getAllAndOverride<boolean>(
        ALLOW_2FA_PENDING,
        [context.getHandler(), context.getClass()],
      );
      if (!allowPending) {
        throw new UnauthorizedException(
          'Validation 2FA requise pour continuer',
        );
      }
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // Priorité au cookie httpOnly (non lisible par JS, résistant au XSS).
    // L'en-tête Authorization reste accepté pour la compatibilité
    // avec les clients API (Swagger, scripts, Postman).
    const cookie = (request as any).cookies?.accessToken;
    if (cookie) return cookie;

    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
