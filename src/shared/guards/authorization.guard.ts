import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthorizeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<string[]>(
      'allowedRoles',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();

    const result = allowedRoles?.some((role) =>
      request?.currentUser?.data?.role?.includes(role),
    );

    if (result) return true;
    throw new UnauthorizedException(
      "Vous n'êtes pas autorisé à accéder à cette ressource.",
    );
  }
}
