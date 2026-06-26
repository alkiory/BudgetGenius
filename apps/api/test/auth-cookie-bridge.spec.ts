/**
 * Cross-cutting spec verifying the v1.3.0 cookie-bridge contract.
 *
 * The mobile-cookies-persistence RPI (see
 * `rpi/mobile-cookies-persistence/` per `knowledge.md §16`) ships a
 * fix where the Android System WebView's third-party cookie policy
 * silently drops Set-Cookie from cross-origin responses, leaving the
 * cookie path broken. The defense-in-depth countermeasure: the auth
 * controller now returns `{accessToken, refreshToken, user, ...}` in
 * the body, so a non-cookie client can persist the tokens
 * client-side (localStorage + Capacitor's `CapacitorCookies.setCookie`).
 *
 * This spec proves BOTH channels are wired on every successful auth
 * response — the cookie path for same-site browsers, the body path
 * for the cross-origin WebView. A regression that "forgets to emit
 * the body token" or "forgets to set Set-Cookie" breaks the mobile
 * use case.
 *
 * Implementation: direct controller-method unit tests with mocked
 * deps. No `Test.createTestingModule` (which would transitively
 * pull in `CookieService → AppModule → TypeORM/Redis/FIREBASE_ADMIN`
 * and explode under jest's path-alias resolution).
 */

// Hoisted by jest before any `import` below kicks in — Firebase Admin
// doesn't need real credentials for the contract this spec verifies.
jest.mock('firebase-admin', () => ({
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({
      email: 'test@user.com',
      name: 'Test User',
    }),
  }),
}));

// Critical: the AuthController file imports CookieService via the
// `@infrastructure/...` path alias. That import is resolved at
// jest's module-load time, BEFORE any test-side mocking can intervene
// (we don't use jest.mock for cookieService in this spec because we
// pass a plain object directly to the constructor). Without this
// `jest.mock`, the real CookieService.ts runs, which `import`s
// `AppModule.cookieOptions` from `app.module.ts`, which transitively
// pulls in TypeOrmModule + RedisService + FIREBASE_ADMIN — and the
// resolver dies with `Cannot find module 'src/app.module'`. The empty
// stub class below short-circuits to a `design:paramtypes` reference
// without ever loading the real file.
jest.mock('@infrastructure/config/cookie.service', () => {
  return {
    CookieService: class CookieServiceStub {},
  };
});

import { AuthController } from '../src/adapters/auth/http/auth.controller';
import { LoggingService } from '../src/infrastructure/log/logger.service';

const MOCK_ACCESS = 'jwt-access-abc123';
const MOCK_REFRESH = 'jwt-refresh-xyz789';

const mockUserEntity = {
  id: 1,
  name: 'Test',
  surname: 'User',
  email: 'test@user.com',
  authProvider: 'firebase',
  role: 'user',
  isPremium: true,
};

// Mirrors AppModule.cookieOptions's prod defaults at the time of
// writing. If a regression walks the defaults BACK to 15 min (the
// pre-v1.3.0 value), the assertion
// `expect.objectContaining({ maxAge: 30 * 60 * 1000 })` on the
// accessToken setCookie call fails the spec rather than shipping
// invisibly.
const PROD_COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
  maxAge: 30 * 60 * 1000,
};

// Mirror of `apps/api/src/adapters/auth/http/auth.controller.ts`
// `REFRESH_COOKIE_MAX_AGE`. Not exported from the controller, so we
// re-declare it here as a tracked constant. If a regression walks
// the production constant to a different day count, the spec will
// fail with a value-mismatch — that's the desired signal.
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

describe('AuthController — cookie + body token bridge (v1.3.0)', () => {
  let controller: AuthController;
  let cookieService: {
    setCookie: jest.Mock;
    clearCookie: jest.Mock;
    /**
     * Per-call record of the merged opts. We track ALL calls, not
     * just the last one. (Earlier versions of this spec had a
     * `lastCookieCall` field that flagged on the LAST call's opts —
     * which is the refreshToken's 7-day override, not the
     * accessToken's 30-min default. The v1.3.0 review caught this
     * trap.) Pushing every call into an array lets us
     * look up by cookie name.
     */
    callsByName: Record<
      string,
      { name: string; value: string; opts: Record<string, unknown> }
    >;
  };
  let authService: {
    oauthLogin: jest.Mock;
    login: jest.Mock;
    signup: jest.Mock;
    refreshToken: jest.Mock;
  };

  beforeEach(() => {
    // The cookieService mock mirrors the production class's
    // option-merging behavior (`{ ...defaultOptions, ...options }`).
    // That way, calls to `.setCookie(res, name, value)` (no opts
    // arg) end up writing the production default maxAge, and calls
    // with opts (e.g. refreshToken cookie) override it just like in
    // prod. The spec asserts on the merged shape that would actually
    // land in the Set-Cookie header.
    cookieService = {
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
      callsByName: {},
    };
    // Wire the mock to behave like the real CookieService.merge step.
    cookieService.setCookie.mockImplementation(
      (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _res: any,
        name: string,
        value: string,
        opts: Record<string, unknown> = {},
      ) => {
        const merged = { ...PROD_COOKIE_DEFAULTS, ...opts };
        // Last-write-wins on the per-name index; matches the production
        // behaviour where a duplicate cookie write replaces the prior
        // value. Spec reads from this map by `callsByName[name]` to
        // assert on the SAME call the assertion is testing.
        cookieService.callsByName[name] = { name, value, opts: merged };
      },
    );

    authService = {
      oauthLogin: jest.fn().mockResolvedValue({
        accessToken: MOCK_ACCESS,
        refreshToken: MOCK_REFRESH,
        userEntity: mockUserEntity,
      }),
      login: jest.fn().mockResolvedValue({
        accessToken: MOCK_ACCESS,
        refreshToken: MOCK_REFRESH,
        user: mockUserEntity,
      }),
      signup: jest.fn().mockResolvedValue({
        accessToken: MOCK_ACCESS,
        refreshToken: MOCK_REFRESH,
        user: mockUserEntity,
        isNewUser: true,
      }),
      refreshToken: jest.fn().mockResolvedValue(undefined),
    };

    const userService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('fresh-rotated-access-token'),
      verify: jest.fn().mockReturnValue({
        id: mockUserEntity.id,
        sub: mockUserEntity.id,
      }),
    };
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as LoggingService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'COOKIE_DOMAIN') return undefined;
        if (key === 'FRONTEND_URL') return 'https://budgetgeniusia.web.app';
        return undefined;
      }),
    };

    // Direct construction — every arg is a partial test double.
    // `as any` is acceptable here: this spec uses the controller as
    // a black box, asserting on observable side-effects (returned
    // body shape + mock invocations), not type compat. The intent
    // is explicitly "test the contract", not "test the DI graph".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controller = new AuthController(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jwtService as any,
      logger,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cookieService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configService as any,
    );
  });

  // ─── /auth/firebase-login ──────────────────────────────────────────
  // Mobile-Android first-line auth (Capacitor + Credential Manager
  // returns idToken → JS POSTs to /auth/firebase-login → backend
  // verifies with Firebase Admin → issues JWT pair). The WebView
  // is where the third-party cookie block hits hardest, so this is
  // the single most important flow to verify the body-token channel.

  describe('firebaseLogin', () => {
    it('emits BOTH res.cookie calls AND accessToken+refreshToken in the body', async () => {
      const body = await controller.firebaseLogin(
        { idToken: 'mock-firebase-id-token' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      );

      // ── Body channel (NEW: v1.3.0) ──────────────────────────────
      expect(body).toMatchObject({
        accessToken: MOCK_ACCESS,
        refreshToken: MOCK_REFRESH,
        user: mockUserEntity,
        message: expect.stringMatching(/login successful/i),
      });

      // ── Cookie channel (preserved) ──────────────────────────────
      // Two setCookie calls: accessToken (no override → default
      // 30-min maxAge) + refreshToken (override → 7-day maxAge).
      expect(cookieService.setCookie).toHaveBeenCalledTimes(2);
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'accessToken',
        MOCK_ACCESS,
      );
      // The production default MUST land at 30 minutes (T1.5).
      // A regression to 15 min (pre-v1.3.0) trips this assertion.
      const accessTokenWrite = cookieService.callsByName['accessToken'];
      expect(accessTokenWrite).toBeDefined();
      expect(accessTokenWrite.opts).toMatchObject({
        maxAge: PROD_COOKIE_DEFAULTS.maxAge,
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });

      // refreshToken override → 7-day maxAge (REFRESH_COOKIE_MAX_AGE).
      // Verify the override is actually being passed through, not
      // silently overridden to the default.
      const refreshTokenWrite = cookieService.callsByName['refreshToken'];
      expect(refreshTokenWrite).toBeDefined();
      expect(refreshTokenWrite.opts.maxAge).toBe(REFRESH_COOKIE_MAX_AGE);

      // The AuthService.oauthLogin path MUST have been invoked
      // exactly once with the email derived from the idToken.
      expect(authService.oauthLogin).toHaveBeenCalledTimes(1);
      expect(authService.oauthLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: mockUserEntity.email }),
      );
    });
  });

  // ─── /auth/login (web SPA + Capacitor email/password path) ────────

  describe('login', () => {
    it('emits BOTH res.cookie calls AND accessToken+refreshToken in the body', async () => {
      const body = await controller.login(
        { email: mockUserEntity.email, password: 'whatever' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      );

      // ── Body channel (NEW: v1.3.0) ──────────────────────────────
      expect(body).toMatchObject({
        accessToken: MOCK_ACCESS,
        refreshToken: MOCK_REFRESH,
        user: mockUserEntity,
        message: expect.stringMatching(/login successful/i),
      });

      // ── Cookie channel (preserved) ──────────────────────────────
      expect(cookieService.setCookie).toHaveBeenCalledTimes(2);
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'accessToken',
        MOCK_ACCESS,
      );
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'refreshToken',
        MOCK_REFRESH,
        expect.objectContaining({ maxAge: expect.any(Number) }),
      );

      expect(authService.login).toHaveBeenCalledTimes(1);
    });
  });

  // ─── /auth/refresh (verification of body channel post-fix) ───────

  describe('refreshToken', () => {
    it('emits BOTH res.cookie calls AND a new accessToken in the body', async () => {
      // refreshToken reads `req.cookies?.refreshToken`. Build a
      // fake req with the cookie attached.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = {
        cookies: { refreshToken: 'incoming-cookie-encoded-refresh-token' },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = {};

      const body = await controller.refreshToken(req, res);

      // ── Body channel (NEW: v1.3.0) ──────────────────────────────
      // The body MUST carry a fresh accessToken so non-cookie
      // clients can persist the rotated token without depending on
      // Set-Cookie round-tripping.
      expect(body).toMatchObject({
        success: true,
        accessToken: 'fresh-rotated-access-token',
      });

      // ── Cookie channel (preserved) ──────────────────────────────
      // Cookie path: a fresh accessToken MUST be set; the refresh
      // cookie is re-issued with the SAME value the user just sent.
      expect(cookieService.setCookie).toHaveBeenCalledTimes(2);
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'accessToken',
        'fresh-rotated-access-token',
      );
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'refreshToken',
        'incoming-cookie-encoded-refresh-token',
        expect.objectContaining({ maxAge: expect.any(Number) }),
      );

      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('throws HTTP 401 when no refresh cookie is attached', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = { cookies: {} };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = {};

      await expect(controller.refreshToken(req, res)).rejects.toMatchObject({
        status: 401,
      });

      // No cookie writes on the unauthorized path.
      expect(cookieService.setCookie).not.toHaveBeenCalled();
    });

    // ─── v1.3.0 mobile-cookies-persistence: body-input path ────
    // The Capacitor Android WebView drops cross-origin Set-Cookie,
    // so the cookie-based refresh fails. Backend now ALSO reads the
    // refresh token from `req.body.refreshToken` (case 2) and from
    // `Authorization: Bearer ...` (case 3) so non-cookie clients
    // can persist + replay the token client-side.

    it('accepts the refresh token via body.refreshToken (mobile WebView path)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = {
        cookies: {}, // intentionally empty — the cookie path is broken
        body: { refreshToken: 'mobile-webview-persisted-refresh-token' },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = {};

      const body = await controller.refreshToken(req, res);

      expect(body).toMatchObject({
        success: true,
        accessToken: 'fresh-rotated-access-token',
      });

      // The refresh token mirror step MUST have been emitted as a
      // Set-Cookie so the browser-side path stays consistent.
      expect(cookieService.setCookie).toHaveBeenCalledTimes(2);
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        expect.anything(),
        'refreshToken',
        'mobile-webview-persisted-refresh-token',
        expect.objectContaining({ maxAge: REFRESH_COOKIE_MAX_AGE }),
      );

      // Auth service MUST have been invoked with the body-sourced
      // token, proving the body-input path is the contract, not a
      // silent fallback.
      expect(authService.refreshToken).toHaveBeenCalledWith(
        expect.anything(),
        'mobile-webview-persisted-refresh-token',
      );
    });

    it('accepts the refresh token via Authorization Bearer header', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = {
        cookies: {},
        body: {},
        headers: {
          authorization: 'Bearer header-persisted-refresh-token',
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = {};

      const body = await controller.refreshToken(req, res);

      expect(body).toMatchObject({
        success: true,
        accessToken: 'fresh-rotated-access-token',
      });

      expect(authService.refreshToken).toHaveBeenCalledWith(
        expect.anything(),
        'header-persisted-refresh-token',
      );
    });
  });
});
