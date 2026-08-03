import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Smoke test e2e : verifie que l'application demarre et que l'endpoint de sante
// repond. Necessite une base MongoDB accessible (DATABASE_URL). Comme le CI ne
// fournit pas toujours de base, le test est ignore proprement si la variable est
// absente plutot que d'echouer.
const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/health -> 200 et status ok', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        if (res.body?.status !== 'ok') {
          throw new Error(`status attendu "ok", recu "${res.body?.status}"`);
        }
      });
  });

  it('GET /api/products -> 200 et enveloppe success', () => {
    return request(app.getHttpServer())
      .get('/api/products?limit=1')
      .expect(200)
      .expect((res) => {
        if (res.body?.success !== true) {
          throw new Error('enveloppe ApiResponse.success attendue');
        }
      });
  });
});
