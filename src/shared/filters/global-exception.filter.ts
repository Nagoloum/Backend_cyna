import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { captureError } from '../sentry';

/**
 * Filtre d'exceptions global.
 *
 * Sépare clairement :
 *  - erreurs métier/utilisateur (HttpException 4xx) → message transmis tel quel ;
 *  - erreurs techniques (500 et exceptions non-HTTP) → loggées intégralement
 *    côté serveur, mais le client ne reçoit qu'un message générique
 *    (jamais de stack trace, message Mongoose, chemin de fichier, etc.).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Journalisation serveur complète (sans données sensibles côté client).
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request?.method ?? ''} ${request?.url ?? ''} → ${status}`,
        stack,
      );
      // Remontée à Sentry (no-op si non configuré) pour les erreurs serveur.
      captureError(exception);
    } else {
      this.logger.warn(
        `${request?.method ?? ''} ${request?.url ?? ''} → ${status}`,
      );
    }

    // Message destiné au client.
    let message = 'Une erreur est survenue. Veuillez réessayer plus tard.';
    if (isHttp && status < 500) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const m = (body as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m.join(' · ') : (m ?? exception.message);
      }
    }

    response.status(status).json({ success: false, message });
  }
}
