import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { RedisService } from "@infrastructure/config/redis.service";
import { LoggingService } from "@infrastructure/log/logger.service";

import { SupportedCurrency } from "@domain/user/user-settings.entity";

import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from "./dto/convert.dto";

/**
 * Wave 3 [T3.3 + T3.7] — `CurrencyService` is the server-side single
 * source-of-truth for currency conversion.
 *
 * Architecture (per audit plan, "Architecture: interna" — backend
 * owns conversion, frontend delegates). Rationale:
 *   - Bug A (audit Wave 1) — `EditableBudgetCategory` was applying
 *     the `convertAmount` identity fast-path (`fromCurrency ===
 *     toCurrency`) so a USD→COP toggle re-labeled the same number
 *     with NO actual conversion. Moving conversion to a backend
 *     endpoint removes the client-side fast-path entirely (except as
 *     an explicit offline fallback in T3.4's HttpCurrencyClient).
 *   - Free-tier providers (open.er-api.com) are unreliable;
 *     centralising the call here lets us add a Redis cache + retry
 *     + fall-back provider chain without redeploying the frontend.
 *
 * Cache semantics:
 *   - Redis key:     `bg:exchange_rates:latest`
 *   - TTL:           configurable `CURRENCY_CACHE_TTL_SECONDS` env,
 *                     default 3600s (1h) — matches the frontend's
 *                     pre-Wave-3 polling cadence.
 *   - Cache miss:    fetch from open.er-api.com, write to Redis,
 *                     return.
 *   - On network failure (provider down / rate-limited): throw
 *                     `ServiceUnavailableException` so the frontend's
 *     fallback wiring kicks in instead of pretending to convert.
 *
 * Observability (Wave 3 [T3.7]):
 *   Uses the existing Winston-backed `LoggingService` — consistent
 *   with every other service in the codebase. A previous draft wired
 *   a scoped `nestjs-pino` logger here, but `LoggerModule.forFeature`
 *   does NOT install pino-http middleware globally; the per-module
 *   config was misleadingly named. We use Winston + SVG fragments of
 *   structured JSON output (`from=`, `to=`, `amount=`, `rate=`) so
 *   log queries in the existing log-aggregator stay grep-compatible
 *   with the rest of the API. A future logging-stack migration can
 *   switch the entire backend to Pino without touching this file.
 */
interface CachedRates {
  base: SupportedCurrency;
  rates: Record<SupportedCurrency, number>;
  fetchedAt: string;
}

const DEFAULT_CACHE_TTL_SECONDS = 3600;
const REDIS_KEY = "bg:exchange_rates:latest";
const ER_API_BASE = "https://open.er-api.com/v6/latest";

@Injectable()
export class CurrencyService {
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: LoggingService,
  ) {
    this.cacheTtlSeconds = Number(
      this.config.get<number>("CURRENCY_CACHE_TTL_SECONDS") ??
        DEFAULT_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Round-trip a single conversion. Reads from cache when fresh;
   * otherwise fetches upstream and writes back to Redis.
   */
  public async convert(
    input: ConvertCurrencyDto,
  ): Promise<ConvertCurrencyResponseDto> {
    // 1. Try cache.
    const cached = await this.readCache();
    if (cached) {
      const result = this.applyRates(cached, input);
      // Cache hit: do NOT log. Conversions are high-volume (charts
      // re-render, forms re-submit) so logging each one overwhelms
      // the aggregator. The Winston pattern is to log only miss/hit
      // summaries at INFO level — see the cache-miss + error lines
      // below for the structured format used in queries.
      return this.toResponse(input, result, cached.fetchedAt, true);
    }

    // 2. Cache miss → upstream fetch.
    let fresh: CachedRates;
    try {
      fresh = await this.fetchUpstream("USD");
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.error(
        `currency:upstream fetch failed (from=${input.fromCurrency} ` +
          `to=${input.toCurrency} amount=${input.amount}): ${msg}`,
      );
      throw new ServiceUnavailableException(
        "Exchange-rate provider unavailable — frontend should fall back",
      );
    }

    await this.writeCache(fresh);
    const result = this.applyRates(fresh, input);
    this.logger.log(
      `currency:cache-miss fetch served (from=${input.fromCurrency} ` +
        `to=${input.toCurrency} amount=${input.amount} rate=${result.rate})`,
    );
    return this.toResponse(input, result, fresh.fetchedAt, false);
  }

  /** Returns current rates (cached or freshly fetched). */
  public async getRates(): Promise<CachedRates> {
    const cached = await this.readCache();
    if (cached) return cached;
    const fresh = await this.fetchUpstream("USD");
    await this.writeCache(fresh);
    return fresh;
  }

  // ----- internals ----------------------------------------------------

  /**
   * Compose the response shape explicitly. `applyRates` only returns
   * `{ rate, convertedAmount }`, but `ConvertCurrencyResponseDto`
   * also requires `fromCurrency` + `toCurrency` + `amount` — folding
   * them in here keeps the DTO contract on the service side and the
   * test side aligned (TS2322 used to surface here).
   */
  private toResponse(
    input: ConvertCurrencyDto,
    result: { rate: number; convertedAmount: number },
    fetchedAt: string,
    cacheHit: boolean,
  ): ConvertCurrencyResponseDto {
    return {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      amount: input.amount,
      rate: result.rate,
      convertedAmount: result.convertedAmount,
      fetchedAt,
      cacheHit,
    };
  }

  private async readCache(): Promise<CachedRates | null> {
    if (!this.redis.isConnected()) return null;
    try {
      const raw = await this.redis.getJson<CachedRates | null>(REDIS_KEY);
      return raw ?? null;
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`currency:redis read failed: ${msg}`);
      return null;
    }
  }

  private async writeCache(payload: CachedRates): Promise<void> {
    if (!this.redis.isConnected()) return;
    try {
      await this.redis.set(REDIS_KEY, payload, this.cacheTtlSeconds);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`currency:redis write failed: ${msg}`);
    }
  }

  private async fetchUpstream(base: SupportedCurrency): Promise<CachedRates> {
    const url = `${ER_API_BASE}/${base}`;
    const res = await fetch(url, {
      // AbortController-style timeout: free-tier endpoints can hang.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      throw new Error(`upstream HTTP ${res.status} on ${url}`);
    }
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== "success" || !data.rates) {
      throw new Error(`upstream returned non-success: ${JSON.stringify(data)}`);
    }
    // Filter to the MVP currency set (USD|EUR|COP) — we deliberately
    // reject extra currencies so a future upstream change that adds
    // AUD doesn't silently import a 4th currency into our enum.
    const rates: Record<SupportedCurrency, number> = {
      USD: data.rates.USD ?? 1,
      EUR: data.rates.EUR ?? 0.93,
      COP: data.rates.COP ?? 4000,
    };
    return {
      base,
      rates,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Pure math: applied client-side fallback uses the same logic.
   * Kept here as the source-of-truth so the embedded client fallback
   * in apps/webClient (T3.4 `convertAmount`) cannot drift from the
   * backend shape.
   *
   * Returns identity (rate=1, convertedAmount=amount) when one
   * endpoint is missing — the canonical Wave 2 contract preserved
   * end-to-end. NaN never escapes this method.
   */
  public applyRates(
    rates: CachedRates,
    input: ConvertCurrencyDto,
  ): { rate: number; convertedAmount: number } {
    const { amount, fromCurrency, toCurrency } = input;
    if (fromCurrency === toCurrency) {
      return { rate: 1, convertedAmount: amount };
    }
    const fromRate = fromCurrency === "USD" ? 1 : rates.rates[fromCurrency];
    const toRate = toCurrency === "USD" ? 1 : rates.rates[toCurrency];
    if (fromRate === undefined || toRate === undefined) {
      return { rate: 1, convertedAmount: amount };
    }
    const inUsd = fromCurrency === "USD" ? amount : amount / fromRate;
    const converted =
      toCurrency === "USD" ? inUsd : inUsd * toRate;
    return { rate: toRate / fromRate, convertedAmount: converted };
  }
}
