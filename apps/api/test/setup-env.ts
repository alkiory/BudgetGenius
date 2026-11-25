/**
 * Jest `setupFiles` entry — runs once per test file, BEFORE any module
 * (including `AppModule`) is imported.
 *
 * Why this exists: the e2e specs (`user-delete-permission.spec.ts`) boot the
 * real `AppModule`, whose `ConfigModule.validate()` aborts when
 * `JWT_SECRET` is missing. Jest runs with `NODE_ENV=test`, and
 * `ConfigModule` only auto-loads `.env.development` when
 * `NODE_ENV === 'development'`, so the e2e suite used to fail with
 * "JWT_SECRET is required" even on a fully provisioned machine.
 *
 * Behaviour:
 *   - Any value already present in `process.env` WINS (dotenv does not
 *     override), so CI can point the suite at its own Postgres/Redis
 *     services simply by exporting DB_* / REDIS_* / JWT_SECRET.
 *   - Otherwise the local developer env file is loaded, which keeps the
 *     real e2e coverage (the DB-backed delete/cascade assertions) runnable
 *     against the Docker dev database.
 *   - `JWT_SECRET` gets a deterministic fallback so unit-only runs never
 *     depend on a secrets file.
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

const ENV_CANDIDATES = ['.env.development', '.env'];

for (const file of ENV_CANDIDATES) {
  const envPath = resolve(process.cwd(), file);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret';
}
