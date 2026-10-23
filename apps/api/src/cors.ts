/**
 * @module cors
 *
 * CORS configuration for the Budget Genius API. Extracted from
 * `main.ts` so the preflight regression specs exercise the exact same
 * options object the server boots with — before the extraction the
 * spec carried its own copy of the production origin list, which let
 * a real origin-list regression ship unnoticed.
 *
 * Origin lists by environment:
 *
 *   - `PRODUCTION_DEFAULT_ORIGINS` — the deployed web app (Firebase
 *     Hosting) plus the Capacitor Android WebView origins.
 *   - `DEV_DEFAULT_ORIGINS` — everything the local stack uses when
 *     `NODE_ENV !== 'production'`.
 *   - `LOCAL_DEV_SERVER_ORIGINS` — merged into BOTH environments. The
 *     Vite dev server (`localhost:5173`) talks to the DEPLOYED API in
 *     the day-to-day workflow, and the deployed API runs with
 *     `NODE_ENV=production`; without these entries every request from
 *     the dev SPA died on the OPTIONS preflight with
 *     "No 'Access-Control-Allow-Origin' header is present".
 *   - `FRONTEND_URL` — operator-supplied origin(s), single URL or
 *     comma-separated list, merged on top of the defaults.
 *
 * Requests without an `Origin` header (curl, server-to-server) are
 * allowed. Browser requests need an exact match against the allow-list
 * after normalization. Blocked origins are logged so a CORS rejection
 * is diagnosable from the server logs instead of only from the browser
 * console.
 */

import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const corsLogger = new Logger('CORS');

// Default origins served in production. They are merged with whatever
// is declared in the FRONTEND_URL env var so deployment-specific
// domains can be added without code changes.
export const PRODUCTION_DEFAULT_ORIGINS = [
  'https://budgetgeniusia.web.app',
  'https://budgetgeniusia.firebaseapp.com',
  // Capacitor mobile APK origins.
  //   - https://localhost: Capacitor 4+ with androidScheme: 'https' (current default in
  //     mobile/capacitor.config.ts). The Android WebView origin is the host loopback.
  //   - capacitor://localhost: legacy Capacitor 2/3 scheme kept for safety in case a
  //     future build drops back to it. We deliberately do NOT include the
  //     cleartext `http://localhost` in production — cleartext traffic is
  //     disabled in `mobile/capacitor.config.ts` and adding it here would
  //     let a network observer spoof a cookie-bearing request.
  'https://localhost',
  'capacitor://localhost',
];

export const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  // Android emulator → host alias (Capacitor dev mode via server.url)
  'http://10.0.2.2:5173',
  // Capacitor dev modes that use the live-reload server. The native
  // WebView origin is the host loopback under whatever scheme Capacitor
  // picks via `server.androidScheme` (defaults to https in Capacitor 4+).
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
];

/**
 * Vite dev-server origins allowed in EVERY environment, production
 * included. See the module docblock: the SPA is routinely developed on
 * `localhost:5173` against the deployed API, and the deployed API
 * boots with `NODE_ENV=production`, which used to drop the whole
 * `DEV_DEFAULT_ORIGINS` list and block that origin. Scoped to the dev
 * server port only — an attacker-controlled page runs from its own
 * origin, never from `http://localhost:5173`, so the browser will not
 * let it spoof this `Origin` header.
 */
export const LOCAL_DEV_SERVER_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/**
 * Trims whitespace and trailing slashes so we can compare origins
 * exactly against the `Origin` header the browser sends.
 */
export const normalizeOrigin = (raw: string): string =>
  (raw ?? '').trim().replace(/\/+$/, '');

/**
 * FRONTEND_URL may be a single URL or a comma-separated list.
 * Empty entries are dropped; duplicates are de-duplicated by the caller.
 */
export const parseOriginList = (raw: string | undefined | null): string[] =>
  (raw ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

/**
 * Effective allow-list for the given environment: environment defaults
 * + local dev-server origins + whatever `FRONTEND_URL` declares,
 * de-duplicated.
 */
export const buildAllowedOrigins = (
  isProduction: boolean,
  frontendUrlRaw?: string | null,
): string[] =>
  Array.from(
    new Set([
      ...(isProduction ? PRODUCTION_DEFAULT_ORIGINS : DEV_DEFAULT_ORIGINS),
      ...LOCAL_DEV_SERVER_ORIGINS,
      ...parseOriginList(frontendUrlRaw),
    ]),
  );

/**
 * The `enableCors` payload built from an allow-list. Kept next to the
 * list itself so `main.ts` and the preflight specs cannot drift apart.
 */
export const buildCorsOptions = (
  allowedOrigins: readonly string[],
): CorsOptions => ({
  origin: (origin, callback) => {
    // No Origin header → not a browser cross-origin call.
    if (!origin) {
      return callback(null, true);
    }
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    corsLogger.warn(`🛑 CORS: blocking request from origin '${origin}'`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Device-Id',
  ],
  credentials: true,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});
