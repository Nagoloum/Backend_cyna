import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CommandesService } from './commandes.service';
import { CronGuard } from '../../shared/guards/cron.guard';
import { ApiResponse } from '../../shared/responses/api-response';

// Endpoints déclenchés par Vercel Cron (voir vercel.json → crons). Protégés par
// CronGuard (secret CRON_SECRET). Aucune session utilisateur : ce sont des
// tâches planifiées côté plateforme.
@ApiExcludeController()
@Controller('cron')
export class CronController {
  constructor(private readonly commandesService: CommandesService) {}

  // Tâche quotidienne : expire les abonnements dont l'échéance est dépassée.
  @UseGuards(CronGuard)
  @Get('abonnements')
  async runSubscriptionLifecycle() {
    const result = await this.commandesService.processExpiredSubscriptions();
    return ApiResponse.success(
      'Cycle de vie des abonnements traité',
      result,
    );
  }
}
