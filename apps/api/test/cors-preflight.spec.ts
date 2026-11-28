import { Controller, Get, INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');

import { buildCorsOptions, PRODUCTION_DEFAULT_ORIGINS } from '../src/cors';

@Controller('dashboard')
class TestDashboardController {
  @Get('overview')
  getOverview() {
    return {
      balance: 0,
      income: 0,
      expenses: 0,
      period: { month: 1, year: 2026 },
    };
  }
}

/**
 * The spec used to carry its own copy of the production header list, so
 * `cors.ts` could lose a header without any test failing — which is how
 * `Idempotency-Key` shipped while the browser was already sending it.
 * It now boots with the same options object `main.ts` uses.
 */
describe('CORS preflight — header enumeration (v1.3.0.x regression guard)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestDashboardController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    app.setGlobalPrefix('/api');
    app.enableCors(buildCorsOptions(PRODUCTION_DEFAULT_ORIGINS));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('OPTIONS /api/dashboard/overview from a Capacitor Android WebView origin echoes X-Device-Id in Access-Control-Allow-Headers (204)', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/dashboard/overview')
      .set('Origin', 'https://localhost')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-device-id');

    expect(response.status).toBe(204);

    const allowHeadersRaw = response.headers['access-control-allow-headers'];
    expect(allowHeadersRaw).toBeDefined();
    const allowHeaders = String(allowHeadersRaw).toLowerCase();
    expect(allowHeaders).toContain('x-device-id');
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('content-type');

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://localhost',
    );

    // Methods must include the requested GET.
    const methods = String(
      response.headers['access-control-allow-methods'] ?? '',
    );
    expect(methods).toMatch(/\bGET\b/);
  });

  it('OPTIONS /api/transactions/import from the hosted frontend origin allows Idempotency-Key (204)', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/transactions/import')
      .set('Origin', 'https://budgetgeniusia.web.app')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization,idempotency-key',
      );

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://budgetgeniusia.web.app',
    );

    const allowHeaders = String(
      response.headers['access-control-allow-headers'] ?? '',
    ).toLowerCase();
    expect(allowHeaders).toContain('idempotency-key');
    expect(allowHeaders).toContain('content-type');
  });

  it('OPTIONS from an origin outside PRODUCTION_DEFAULT_ORIGINS is NOT echoed (blocks preflight)', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/dashboard/overview')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-device-id');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
  });
});
