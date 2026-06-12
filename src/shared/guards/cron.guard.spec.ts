import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CronGuard } from './cron.guard';

// Construit un faux ExecutionContext exposant les en-têtes voulus.
const ctxWithAuth = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('CronGuard', () => {
  let guard: CronGuard;
  const ORIGINAL = process.env.CRON_SECRET;

  beforeEach(() => {
    guard = new CronGuard();
  });

  afterAll(() => {
    process.env.CRON_SECRET = ORIGINAL;
  });

  it('refuse si CRON_SECRET non configuré', () => {
    delete process.env.CRON_SECRET;
    expect(() => guard.canActivate(ctxWithAuth('Bearer x'))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuse si le header ne correspond pas au secret', () => {
    process.env.CRON_SECRET = 'top-secret';
    expect(() => guard.canActivate(ctxWithAuth('Bearer wrong'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(ctxWithAuth(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepte si le header porte le bon secret', () => {
    process.env.CRON_SECRET = 'top-secret';
    expect(guard.canActivate(ctxWithAuth('Bearer top-secret'))).toBe(true);
  });
});
