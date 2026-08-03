import { Injectable, Logger } from '@nestjs/common';

type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Journal des événements métier (inscription, commande, contact...).
 * Les événements sont écrits dans les logs applicatifs (Winston), sans
 * donnée personnelle : ils servent au suivi d'activité côté exploitation.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  track(event: string, properties?: AnalyticsProps): void {
    const props =
      properties && Object.keys(properties).length > 0
        ? ` ${JSON.stringify(properties)}`
        : '';
    this.logger.log(`event=${event}${props}`);
  }
}
