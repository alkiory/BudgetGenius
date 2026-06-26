const PROD_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Device-Id',
] as const;

const PROD_ALLOWED_ORIGINS = [
  'https://budgetgeniusia.web.app',
  'https://budgetgeniusia.firebaseapp.com',
  'https://localhost', // Capacitor 4+ with `androidScheme: 'https'`
  'capacitor://localhost', // Capacitor 2/3 legacy
] as const;

import { Controller, Get, INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');

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

describe('CORS preflight — X-Device-Id enumeration (v1.3.0.x regression guard)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestDashboardController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    app.setGlobalPrefix('/api');
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        const normalized = origin.trim().replace(/\/+$/, '');
        if ((PROD_ALLOWED_ORIGINS as readonly string[]).includes(normalized)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: [...PROD_ALLOWED_HEADERS],
      credentials: true,
      optionsSuccessStatus: 204,
      exposedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });

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

  it('OPTIONS from an origin outside PROD_ALLOWED_ORIGINS is NOT echoed (blocks preflight)', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/dashboard/overview')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-device-id');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
  });
});
