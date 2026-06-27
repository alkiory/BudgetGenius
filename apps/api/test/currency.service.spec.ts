import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { CurrencyService } from '@infrastructure/currency/currency.service';
import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from '@infrastructure/currency/dto/convert.dto';
import { RedisService } from '@infrastructure/config/redis.service';
import { LoggingService } from '@infrastructure/log/logger.service';

describe('CurrencyService [Wave 3 T3.6]', () => {
  let service: CurrencyService;
  let redisSetCalls: number;
  let redisGetCalls: number;
  // ReturnType<typeof jest.fn> avoids the TS2740 "bare jest.Mock requires
  // <ReturnType, Args, C> generics" error reported by tsc and keeps the
  // mock compatible with jest's runtime methods (mockResolvedValueOnce,
  // mockClear, etc.) without forcing an explicit signature pegged to the
  // global fetch overloads.
  // Bare `jest.Mock` is fine here — the TS2740 originally flagged was
  // emitted by the redis cast at L170/175 (not by this declaration),
  // so we keep the simpler annotation that preserves the loaded mock
  // surface (`mockResolvedValueOnce`, `mockClear`, …) without forcing
  // a signature pegged to the global `fetch` overloads.
  let mockedFetch: jest.Mock;

  const RATES = { USD: 1, EUR: 0.93, COP: 4000 };

  beforeEach(async () => {
    redisSetCalls = 0;
    redisGetCalls = 0;
    mockedFetch = jest.fn();

    (global as { fetch?: unknown }).fetch = mockedFetch;

    const fakeRedis: Partial<RedisService> = {
      isConnected: () => true,
      getJson: async <T>(): Promise<T | null> => {
        redisGetCalls += 1;
        return null; // cold cache, every test reads cache-miss
      },
      set: async (): Promise<void> => {
        redisSetCalls += 1;
      },
    };

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
              k === 'CURRENCY_CACHE_TTL_SECONDS' ? 3600 : undefined,
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

  it('round-trips USD→EUR→USD within float-precision tolerances', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: RATES }),
    });

    const a = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      amount: 100,
    } as ConvertCurrencyDto);
    expect(a.convertedAmount).toBeCloseTo(93, 6);
    expect(a.cacheHit).toBe(false);

    const b = await service.convert({
      fromCurrency: 'EUR',
      toCurrency: 'USD',
      amount: a.convertedAmount,
    } as ConvertCurrencyDto);
    expect(b.convertedAmount).toBeCloseTo(100, 6);
  });

  it('returns identity when both currencies match', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: RATES }),
    });
    const res = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'USD',
      amount: 42,
    } as ConvertCurrencyDto);
    expect(res.rate).toBe(1);
    expect(res.convertedAmount).toBe(42);
    expect(res.cacheHit).toBe(false);
  });

  it('gracefully degrades when one endpoint rate is missing', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        result: 'success',
        rates: { USD: 1, EUR: 0.93 /* COP missing */ },
      }),
    });

    const res = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'COP',
      amount: 1234,
    } as ConvertCurrencyDto);

    expect(res.rate).toBe(1);
    expect(res.convertedAmount).toBe(1234); // identity fallback, not NaN
    expect(res.cacheHit).toBe(false);
  });

  it('COP precision is preserved (0 decimal places per currency rules)', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: RATES }),
    });

    const res = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'COP',
      amount: 10, // 10 * 4000 = 40000 COP, no fractional part expected
    } as ConvertCurrencyDto);

    expect(res.rate).toBe(4000);
    expect(res.convertedAmount).toBe(40000);
    expect(Number.isInteger(res.convertedAmount)).toBe(true);
  });

  it('caches a fresh upstream fetch and flags the next call cacheHit=true', async () => {
    // First call: cache miss.
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: RATES }),
    });

    const first = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      amount: 50,
    } as ConvertCurrencyDto);
    expect(first.cacheHit).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Type cast uses function signatures (not jest.Mock) so the literal
    // `{...}` below satisfies the structural type without depending on
    // jest.Mock's instance methods (mockImplementation, mockReturnValue,
    // etc.) that a plain async function doesn't carry. This is what
    // tripped the TS2740 the reviewer flagged in v1.4.x.
    //
    // Drop the generic here: the production `RedisService.getJson` is
    // `<T>(key: string) => Promise<T | null>`, but at the mock layer we
    // don't care about T's binding — the literal
    // `{ base, rates, fetchedAt }` only needs to be assignable to a
    // static `Promise<unknown> | Promise<null>` slot. Keeping `<T>`
    // (even defaulted to `unknown`) tripped TS2322 at the assignment
    // because TS didn't bind T from the literal at the call site — so
    // the non-generic signature below is the simplest fix that's both
    // type-safe AND runtime-compatible.
    (
      service as unknown as {
        redis: {
          isConnected: () => boolean;
          getJson: () => Promise<unknown>;
          set: (key: string, value: string, ttl?: number) => Promise<void>;
        };
      }
    ).redis = {
      isConnected: () => true,
      getJson: async () => ({
        base: 'USD',
        rates: RATES,
        fetchedAt: first.fetchedAt,
      }),
      set: async () => undefined,
    };

    const second = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      amount: 50,
    } as ConvertCurrencyDto);
    expect(second.cacheHit).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1); // no second upstream fetch
  });

  it('response shape conforms to ConvertCurrencyResponseDto contract', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: RATES }),
    });

    const res = await service.convert({
      fromCurrency: 'USD',
      toCurrency: 'COP',
      amount: 12,
    } as ConvertCurrencyDto);

    const expected: ConvertCurrencyResponseDto = expect.objectContaining({
      fromCurrency: 'USD',
      toCurrency: 'COP',
      amount: 12,
      convertedAmount: 48000,
      rate: 4000,
      cacheHit: false,
    });
    expect(res).toEqual(expected);
    expect(typeof res.fetchedAt).toBe('string');
    expect(res.fetchedAt.startsWith('20')).toBe(true);
  });
});
