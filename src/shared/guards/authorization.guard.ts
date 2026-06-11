import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
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

    // Égalité stricte : `.includes()` sur une string accepterait des
    // sous-chaînes (ex. un rôle "ADMIN_READONLY" passerait pour "ADMIN").
    const result = allowedRoles?.some(
      (role) => request?.currentUser?.data?.role === role,
    );

    if (result) return true;
    throw new ForbiddenException(
      "Vous n'êtes pas autorisé à accéder à cette ressource.",
    );
  }
}
