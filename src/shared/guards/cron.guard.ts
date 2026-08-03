import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Protège les endpoints de cron : seuls les appels portant l'en-tête
 * `Authorization: Bearer <CRON_SECRET>` sont acceptés (voir le workflow
 * GitHub Actions cron-abonnements.yml). Sans secret configuré, l'accès est
 * refusé (jamais ouvert par défaut).
 */
@Injectable()
export class CronGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET non configuré');
    }
    const request = context.switchToHttp().getRequest();
    const authorization: string = request?.headers?.authorization ?? '';
    if (authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Accès cron refusé');
    }
    return true;
  }
}
