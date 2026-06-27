import { Module } from "@nestjs/common";

import { RedisService } from "@infrastructure/config/redis.service";

import { CurrencyController } from "./currency.controller";
import { CurrencyService } from "./currency.service";

/**
 * Wave 3 [T3.3] — `CurrencyModule` exposes the server-side
 * `/currency/*` endpoints and lets the auditing dashboards query
 * conversion cache misses + errors through the existing Winston
 * logger (T3.7 — see `currency.service.ts` for the structured log
 * format).
 *
 * `JwtAuthGuard` is intentionally NOT listed in `providers`. The
 * controller applies `@UseGuards(JwtAuthGuard)` at the class level;
 * NestJS resolves guards by class reference (not DI), so it works
 * without provider registration. Listing it here would silently turn
 * it into a normal provider with constructor-injection semantics and
 * a misconfigured DI graph if its constructor ever gains a dep.
 *
 * Observability scope (Wave 3 [T3.7]): the CurrencyService logs via
 * the shared `LoggingService` (Winston-backed). A previous draft
 * registered a per-module `LoggerModule.forFeature({ pinoHttp: ... })`
 * here but that config does NOT install pino-http middleware
 * globally — the redact paths would have matched nothing. Using the
 * shared Winston logger keeps the conversion observability
 * grep-compatible with every other service in the codebase.
 */
@Module({
  providers: [CurrencyService, RedisService],
  controllers: [CurrencyController],
  exports: [CurrencyService],
})
export class CurrencyModule {}
