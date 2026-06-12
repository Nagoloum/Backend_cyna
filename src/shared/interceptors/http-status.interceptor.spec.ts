import { of, lastValueFrom } from 'rxjs';
import { HttpStatusInterceptor } from './http-status.interceptor';
import { ApiResponse } from '../responses/api-response';

const makeCtx = (res: any): any => ({
  switchToHttp: () => ({ getResponse: () => res }),
});
const makeHandler = (body: any): any => ({ handle: () => of(body) });

describe('ApiResponse', () => {
  it('associe le bon code HTTP à chaque helper', () => {
    expect(ApiResponse.notFound('x').statusCode).toBe(404);
    expect(ApiResponse.forbidden('x').statusCode).toBe(403);
    expect(ApiResponse.conflict('x').statusCode).toBe(409);
    expect(ApiResponse.unauthorized('x').statusCode).toBe(401);
    expect(ApiResponse.error('x').statusCode).toBe(400);
    expect(ApiResponse.success('ok', { a: 1 }).success).toBe(true);
    expect(ApiResponse.error('x').success).toBe(false);
  });
});

describe('HttpStatusInterceptor', () => {
  let interceptor: HttpStatusInterceptor;
  let res: { status: jest.Mock; setHeader: jest.Mock };

  beforeEach(() => {
    interceptor = new HttpStatusInterceptor();
    res = { status: jest.fn(), setHeader: jest.fn() };
  });

  it('laisse passer une réponse succès sans toucher au statut', async () => {
    const body = ApiResponse.success('ok', { a: 1 });
    const out = await lastValueFrom(
      interceptor.intercept(makeCtx(res), makeHandler(body)),
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(out).toBe(body);
  });

  it('applique le code 404 + header X-App-Error et retire statusCode', async () => {
    const body = ApiResponse.notFound('introuvable');
    const out = await lastValueFrom(
      interceptor.intercept(makeCtx(res), makeHandler(body)),
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-App-Error', '1');
    expect(out.success).toBe(false);
    expect(out.message).toBe('introuvable');
    expect(out.statusCode).toBeUndefined();
  });

  it('défaut 400 quand aucun statusCode explicite', async () => {
    const body = ApiResponse.error('mauvaise requête');
    await lastValueFrom(
      interceptor.intercept(makeCtx(res), makeHandler(body)),
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
