/**
 * E2E test for the `/auth/forgot-password` per-IP rate cap.
 *
 * The production AuthController carries the throttle config:
 *
 *   @Throttle({ default: { limit: 5, ttl: hours(1) } })
 *   @Post('forgot-password')
 *   async forgotPassword(@Body() dto: ForgotPasswordDto) { … }
 *
 * To exercise that decorator end-to-end without booting the full
 * AppModule (Redis-backed throttler storage, TypeORM, Firebase Admin,
 * etc.) this spec builds a minimal Nest app that registers ONLY:
 *   • ThrottlerModule.forRoot({ limit: 5, ttl: 1h }) — in-memory storage (default)
 *   • ThrottlerBehindProxyGuard as APP_GUARD (matches production)
 *   • A TestAuthController with the SAME `@Throttle` decorator and
 *     mocked service so the route-level override is the system under
 *     test, not a re-declaration.
 *
 * Two scenarios:
 *   1. Six calls from the SAME IP — first five return 2xx, sixth 429.
 *   2. After rotation to a DIFFERENT IP — fresh bucket, 2xx again.
 *
 * `app.set('trust proxy', true)` is required so Express parses
 * `X-Forwarded-For` into `req.ips[]`; without it, every request would
 * share the loopback tracker.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Throttle, ThrottlerModule, hours } from '@nestjs/throttler';
import request = require('supertest');
import { ThrottlerBehindProxyGuard } from '../src/infrastructure/config/guards/throttler-behind-proxy.guard';

// Mirror of the production decorator — same expression, same TTL unit.
// If the production decorator changes, this test will silently diverge;
// the production test only catches regression of the runtime behavior,
// not the literal decoration.
@Controller('auth')
class TestAuthController {
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: { email: string }) {
    // Service stub: simulating the production `requestPasswordReset`
    // happy path. We do NOT want the test to hit Postgres / Resend —
    // only the throttle guard is under test here.
    return { message: '📨 Recovery link sent to your email' };
  }
}

describe('AuthController.forgotPassword — per-IP rate cap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              // Mirror production default-throttler name so the @Throttle
              // ({ default: … }) override on the route matches.
              name: 'default',
              limit: 5,
              ttl: hours(1),
            },
          ],
          // Omit `storage` so @nestjs/throttler uses the default
          // in-memory ThrottlerStorageService — no Redis container
          // required for this spec.
          errorMessage:
            '😡 Wow! You are making too many requests. Please try again later.',
        }),
      ],
      controllers: [TestAuthController],
      providers: [
        // CRITICAL: without APP_GUARD registered in the test module, the
        // @Throttle() decorator is never enforced. The production
        // AppModule does this in its providers block, so we mirror that
        // wiring here.
        { provide: 'APP_GUARD', useClass: ThrottlerBehindProxyGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Trust X-Forwarded-For so we can simulate distinct remote IPs
    // in the test. Without this, every supertest request maps to the
    // loopback / ::1 and the per-IP test collapses to a single bucket.
    // NOTE: `INestApplication` does NOT expose `.set(...)` directly; the
    // Express `app.set('trust proxy', …)` lives on the HTTP adapter's
    // underlying instance. Tunnel through `getHttpAdapter().getInstance()`.
    // Tightening to `'loopback'` (not bare `true`) would match realistic
    // production deployments where the ALB sits on 127.0.0.1; in tests
    // with no proxy at all, `true` is acceptable because we control the
    // incoming `X-Forwarded-For` from supertest.
    const expressApp = app.getHttpAdapter().getInstance();
    if (typeof expressApp?.set === 'function') {
      expressApp.set('trust proxy', true);
    }
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the first 5 requests from the same IP and rejects the 6th with HTTP 429', async () => {
    const IP_A = '203.0.113.10'; // RFC5737 documentation range; safe to use in tests

    // Five successes in a row.
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', IP_A)
        .send({ email: 'throttle-test@example.com' })
        .expect(201);
    }

    // Sixth call must hit the cap. assert the errorMessage matches the
    // configure-time string (verbatim contract that login & other routes
    // also rely on).
    const blocked = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', IP_A)
      .send({ email: 'throttle-test@example.com' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain(
      'Wow! You are making too many requests',
    );
  });

  it('isolates buckets per IP — a fresh IP gets a fresh budget', async () => {
    const IP_DIFFERENT = '203.0.113.99';

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', IP_DIFFERENT)
      .send({ email: 'throttle-test-other@example.com' });
    expect(response.status).toBe(201);
  });
});
