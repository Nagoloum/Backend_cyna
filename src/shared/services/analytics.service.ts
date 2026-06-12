import { Injectable, Logger } from '@nestjs/common';

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

// @vercel/analytics/server is ESM-only (.mjs) — static require() fails in
// the CommonJS NestJS build. Use a lazy dynamic import() so Node resolves it
// via the ESM loader at call-time instead of at module bootstrap.
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  track(event: string, properties?: AnalyticsProps): void {
    void import('@vercel/analytics/server')
      .then(({ track }) => track(event, properties))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Echec d'envoi de l'evenement "${event}": ${message}`);
      });
  }
}
