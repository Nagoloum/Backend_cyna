import { Injectable, Logger } from '@nestjs/common';
import { track } from '@vercel/analytics/server';

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Envoi d'evenements metier vers Vercel Web Analytics (custom events).
 *
 * - Ne transmet jamais de donnees personnelles (pas d'email, nom, id…) :
 *   uniquement des proprietes agregables (montant, role, periode…).
 * - Ne bloque ni ne casse jamais le flux metier : toute erreur est avalee et
 *   l'appel est "fire-and-forget".
 * - Hors environnement Vercel (local, tests), `track` est un no-op : rien a
 *   configurer pour developper. En production, l'ingestion se fait
 *   automatiquement si Web Analytics est active sur le projet backend.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  track(event: string, properties?: AnalyticsProps): void {
    // Volontairement non bloquant : on n'attend pas la promesse et on capture
    // tout rejet (ou tout throw synchrone) pour qu'un incident analytics
    // n'impacte jamais la requete metier.
    try {
      void track(event, properties).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Echec d'envoi de l'evenement "${event}": ${message}`);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Echec d'envoi de l'evenement "${event}": ${message}`);
    }
  }
}
