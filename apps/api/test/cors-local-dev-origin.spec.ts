import { Controller, Get, INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import {
  buildAllowedOrigins,
  buildCorsOptions,
} from '../src/cors';

/**
 * Minimal stand-in for the real `GET/PATCH /api/user-settings`
 * controller — only the route path matters, we are asserting the CORS
 * handshake around it, not the handler itself.
 */
@Controller('user-settings')
class TestUserSettingsController {
  @Get()
  getSettings() {
    return {
      id: 1,
      timezone: 'UTC',
      currency: 'EUR',
      locale: 'es-CO',
      hasCompletedOnboarding: false,
    };
  }
}

/**
 * Regression guard for the onboarding CORS breakage: the SPA runs on
 * `localhost:5173` (Vite dev server) while the API is the DEPLOYED
 * environment, which boots with `NODE_ENV=production`. The production
 * allow-list used to be `PRODUCTION_DEFAULT_ORIGINS` only, so every
 * request from the dev SPA died on the OPTIONS preflight with
 * "No 'Access-Control-Allow-Origin' header is present" and the
 * onboarding wizard could not even read `/api/user-settings`.
 *
 * These tests build the allow-list + options through the SAME helpers
 * `main.ts` boots with (`src/cors.ts`), so a future edit that drops
 * the localhost dev origins fails here instead of in a browser.
 */
describe('CORS — localhost:5173 dev origin against the production allow-list', () => {
  const LOCAL_ORIGIN = 'http://localhost:5173';

  let app: INestApplication;

  beforeAll(async () => {
    // Production-shaped environment: no FRONTEND_URL override, exactly
    // what the deployed container runs with.
    const allowedOrigins = buildAllowedOrigins(true, undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestUserSettingsController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('/api');
    app.enableCors(buildCorsOptions(allowedOrigins));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps http://localhost:5173 in the production allow-list', () => {
    expect(buildAllowedOrigins(true, undefined)).toContain(LOCAL_ORIGIN);
    // …and the development list keeps working too (deduplicated merge).
    expect(buildAllowedOrigins(false, undefined)).toContain(LOCAL_ORIGIN);
  });

  it('merges operator FRONTEND_URL origins on top of the defaults', () => {
    const allowed = buildAllowedOrigins(
      true,
      'https://staging.budgetgenius.example, http://localhost:5173/',
    );
    expect(allowed).toContain('https://staging.budgetgenius.example');
    expect(allowed).toContain(LOCAL_ORIGIN);
  });

  it('answers the onboarding preflight (PATCH /api/user-settings) with Access-Control-Allow-Origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/user-settings')
      .set('Origin', LOCAL_ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization,x-device-id',
      );

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(LOCAL_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');

    const methods = String(
      response.headers['access-control-allow-methods'] ?? '',
    );
    expect(methods).toMatch(/\bPATCH\b/);

    const allowHeaders = String(
      response.headers['access-control-allow-headers'] ?? '',
    ).toLowerCase();
    expect(allowHeaders).toContain('content-type');
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('x-device-id');
  });

  it('returns 200 + Access-Control-Allow-Origin for the actual GET from localhost:5173', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/user-settings')
      .set('Origin', LOCAL_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(LOCAL_ORIGIN);
    expect(response.body).toEqual({
      id: 1,
      timezone: 'UTC',
      currency: 'EUR',
      locale: 'es-CO',
      hasCompletedOnboarding: false,
    });
  });

  it('still blocks an origin outside the allow-list', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/user-settings')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
  });

  it('keeps the production web + Capacitor origins allowed', () => {
    const allowed = buildAllowedOrigins(true, undefined);
    expect(allowed).toEqual(
      expect.arrayContaining([
        'https://budgetgeniusia.web.app',
        'https://budgetgeniusia.firebaseapp.com',
        'https://localhost',
        'capacitor://localhost',
      ]),
    );
  });
});
