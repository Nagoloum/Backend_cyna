import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Initialise Sentry uniquement si SENTRY_DSN est défini. Sans DSN, c'est un
 * no-op : rien à configurer en développement, monitoring actif en production
 * dès que la variable est renseignée.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Sur Vercel (serverless), l'auto-instrumentation OpenTelemetry de @sentry/node
  // (patch http/dns/net/mongodb au chargement) peut BLOQUER la connexion Mongoose
  // au demarrage a froid (connexion figee en readyState=2 -> 500). On desactive
  // donc Sentry backend sur Vercel (SENTRY_ENABLED=true pour forcer si besoin).
  if (process.env.VERCEL && process.env.SENTRY_ENABLED !== 'true') return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Pas de tracing de perf par défaut (uniquement le reporting d'erreurs).
    tracesSampleRate: 0,
  });
  enabled = true;
}

/** Remonte une exception à Sentry (no-op si non initialisé). */
export function captureError(error: unknown): void {
  if (enabled) {
    Sentry.captureException(error);
  }
}
