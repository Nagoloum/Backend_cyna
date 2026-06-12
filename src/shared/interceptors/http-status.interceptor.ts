import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

/**
 * Aligne le code HTTP sur le résultat métier : quand un contrôleur RENVOIE une
 * `ApiResponse` avec `success === false`, on applique un vrai code 4xx (issu de
 * `statusCode`, défaut 400) au lieu d'un 200 trompeur, et on marque la réponse
 * d'un en-tête `X-App-Error` pour que le frontend puisse distinguer une erreur
 * métier (enveloppe {success:false}) d'une erreur technique.
 *
 * Les exceptions LEVÉES (validation, guards, HttpException explicites) ne
 * passent pas ici : elles sont gérées par GlobalExceptionFilter, sans en-tête,
 * donc le frontend continue de les rejeter comme avant.
 */
@Injectable()
export class HttpStatusInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === 'object' && (body as any).success === false) {
          const res = context.switchToHttp().getResponse<Response>();
          const raw = body as Record<string, any>;
          const status =
            typeof raw.statusCode === 'number'
              ? raw.statusCode
              : HttpStatus.BAD_REQUEST;
          res.status(status);
          res.setHeader('X-App-Error', '1');
          // On ne renvoie jamais le champ interne statusCode au client.
          const { statusCode: _omit, ...rest } = raw;
          return rest;
        }
        return body;
      }),
    );
  }
}
