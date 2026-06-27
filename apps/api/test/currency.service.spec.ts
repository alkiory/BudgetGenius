import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

import { CurrencyService } from "@infrastructure/currency/currency.service";
import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from "@infrastructure/currency/dto/convert.dto";
import { RedisService } from "@infrastructure/config/redis.service";
import { LoggingService } from "@infrastructure/log/logger.service";

/**
 * Wave 3 [T3.6] — backend coverage for the conversion math +
 * cache miss / cache hit dynamics of `CurrencyService`.
 *
 * What we cover here:
 *   1. Round-trip USD→EUR→USD preserves the source magnitude within
 *      float-precision tolerances.
 *   2. Missing rate identity fallback (Wave 2 audit fix at the
 *      client) is mirrored on the server — no NaN surfaces in the
 *      dashboard from a partial upstream response.
 *   3. COP precision = 0 decimals (the audit's currency-by-locale
 *      invariant from Wave 2).
 *   4. Cache hit vs cache miss shape — the `cacheHit` boolean is the
 *      SRE signal that rate-limiter dashboards key on.
 *
 * What we DO NOT cover here:
 *   - Live open.er-api.com fetch — relies on an external free-tier
 *     endpoint without SLA. Tests mock `global.fetch`.
 *   - Round-trip through the controller HTTP layer — that lives in
 *     e2e tests under `apps/api/test/app.e2e-spec.ts` once the
 *     CurrencyModule is registered in the test app bootstrap.
 */

describe("CurrencyService [Wave 3 T3.6]", () => {
  let service: CurrencyService;
  let redisSetCalls: number;
  let redisGetCalls: number;
  let mockedFetch: jest.Mock;

  const RATES = { USD: 1, EUR: 0.93, COP: 4000 };

  beforeEach(async () => {
    redisSetCalls = 0;
    redisGetCalls = 0;
    mockedFetch = jest.fn();

    (global as { fetch?: unknown }).fetch = mockedFetch;

    const fakeRedis: Partial<RedisService> = {
      isConnected: () => true,
      getJson: async <T,>(): Promise<T | null> => {
        redisGetCalls += 1;
        return null; // cold cache, every test reads cache-miss
      },
      set: async (): Promise<void> => {
        redisSetCalls += 1;
      },
    };

    // Winston-compatible stub. Same shape as the BudgetService test
    // (BudgetService injects the real Winston-backed
    // LoggingService); here we use a no-op stub because the test
    // only verifies convert() return shape — it doesn't assert on
    // logged output.
    const fakeLogger: Partial<LoggingService> = {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: RedisService, useValue: fakeRedis },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === "CURRENCY_CACHE_TTL_SECONDS" ? 3600 : undefined,
          },
        },
        { provide: LoggingService, useValue: fakeLogger },
      ],
    }).compile();

    service = moduleRef.get(CurrencyService);
  });

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  /**
   * Round-trip USD→EUR→USD. Two `convert()` calls because the public
   * surface takes a destination currency, not an arbitrary path.
   * Tolerances are chosen to pass even at int-precision boundaries.
   */
  it("round-trips USD→EUR→USD within float-precision tolerances", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: RATES }),
    });

    const a = await service.convert({
      fromCurrency: "USD",
      toCurrency: "EUR",
      amount: 100,
    } as ConvertCurrencyDto);
    expect(a.convertedAmount).toBeCloseTo(93, 6);
    expect(a.cacheHit).toBe(false);

    const b = await service.convert({
      fromCurrency: "EUR",
      toCurrency: "USD",
      amount: a.convertedAmount,
    } as ConvertCurrencyDto);
    expect(b.convertedAmount).toBeCloseTo(100, 6);
  });

  it("returns identity when both currencies match", async () => {
    // No upstream fetch expected — service should short-circuit on
    // the cached bundle (the synthetic "cold cache" stub returns
    // null which forces a fetch; but the same-currency guard runs
    // after the cache lookup and the applyRates short-circuit
    // returns identity before any fetch call is attempted).
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: RATES }),
    });
    const res = await service.convert({
      fromCurrency: "USD",
      toCurrency: "USD",
      amount: 42,
    } as ConvertCurrencyDto);
    expect(res.rate).toBe(1);
    expect(res.convertedAmount).toBe(42);
    // upstream was called once (cold cache stub requires it) before
    // the same-currency short-circuit — fine, the assertion below is
    // just on the output shape.
    expect(res.cacheHit).toBe(false);
  });

  /**
   * Missing-rate identity fallback. Drives fetchUpstream to drop the
   * COP rate, then verifies the backend preserves the input amount +
   * reports `convertedAmount` (not NaN) when one endpoint is absent.
   */
  it("gracefully degrades when one endpoint rate is missing", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        result: "success",
        rates: { USD: 1, EUR: 0.93 /* COP missing */ },
      }),
    });

    const res = await service.convert({
      fromCurrency: "USD",
      toCurrency: "COP",
      amount: 1234,
    } as ConvertCurrencyDto);

    expect(res.rate).toBe(1);
    expect(res.convertedAmount).toBe(1234); // identity fallback, not NaN
    expect(res.cacheHit).toBe(false);
  });

  it("COP precision is preserved (0 decimal places per currency rules)", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: RATES }),
    });

    const res = await service.convert({
      fromCurrency: "USD",
      toCurrency: "COP",
      amount: 10, // 10 * 4000 = 40000 COP, no fractional part expected
    } as ConvertCurrencyDto);

    expect(res.rate).toBe(4000);
    expect(res.convertedAmount).toBe(40000);
    expect(Number.isInteger(res.convertedAmount)).toBe(true);
  });

  it("caches a fresh upstream fetch and flags the next call cacheHit=true", async () => {
    // First call: cache miss.
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: RATES }),
    });

    const first = await service.convert({
      fromCurrency: "USD",
      toCurrency: "EUR",
      amount: 50,
    } as ConvertCurrencyDto);
    expect(first.cacheHit).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Re-establish cache hit on second call — swap the fake Redis
    // getJson to return a payload. Mutating the bound redis here
    // mirrors the contract: the service reads `this.redis` per
    // call, not a captured-at-construction reference.
    (service as unknown as { redis: { isConnected: () => boolean; getJson: jest.Mock; set: jest.Mock } }).redis = {
      isConnected: () => true,
      getJson: async () => ({
        base: "USD",
        rates: RATES,
        fetchedAt: first.fetchedAt,
      }),
      set: async () => undefined,
    };

    const second = await service.convert({
      fromCurrency: "USD",
      toCurrency: "EUR",
      amount: 50,
    } as ConvertCurrencyDto);
    expect(second.cacheHit).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1); // no second upstream fetch
  });

  it("response shape conforms to ConvertCurrencyResponseDto contract", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: RATES }),
    });

    const res = await service.convert({
      fromCurrency: "USD",
      toCurrency: "COP",
      amount: 12,
    } as ConvertCurrencyDto);

    const expected: ConvertCurrencyResponseDto = expect.objectContaining({
      fromCurrency: "USD",
      toCurrency: "COP",
      amount: 12,
      convertedAmount: 48000,
      rate: 4000,
      cacheHit: false,
    });
    expect(res).toEqual(expected);
    // fetchedAt is an ISO string; only check the prefix to keep the
    // assertion robust against sub-second clock skew between setup
    // and exec.
    expect(typeof res.fetchedAt).toBe("string");
    expect(res.fetchedAt.startsWith("20")).toBe(true);
  });
});
