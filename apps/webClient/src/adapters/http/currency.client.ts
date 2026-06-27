import api from "@infrastructure/api.config";

import type { Currency } from "@presentation/utils/currencyService";

export interface HttpCurrencyClientOptions {
  readonly apiUrl?: string;
  readonly cacheTtlMs?: number;
  readonly fetchTimeoutMs?: number;
}

interface RateEntry {
  rate: number;
  fetchedAt: number;
}

export class HttpCurrencyClient {
  private readonly cache = new Map<string, RateEntry>();
  private readonly inFlight = new Map<string, Promise<number>>();
  private readonly cacheTtlMs: number;
  private readonly fetchTimeoutMs: number;

  constructor(opts: HttpCurrencyClientOptions = {}) {
    this.cacheTtlMs = opts.cacheTtlMs ?? 30_000;
    this.fetchTimeoutMs = opts.fetchTimeoutMs ?? 4_000;
  }

  /**
   * Fetch the rate from `${from}` to `${to}`. Always returns the
   * multiplicative rate (e.g. USD→COP = 4000), so callers multiply
   * `amount * rate`.
   */
  public async fetchRate(from: Currency, to: Currency): Promise<number> {
    if (from === to) return 1;

    const key = `${from}->${to}`;
    const now = Date.now();

    // 1. Cache hit.
    const cached = this.cache.get(key);
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.rate;
    }

    // 2. In-flight dedup.
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    // 3. New fetch.
    const promise = this.fetchWithTimeout(`${from}->${to}`, from, to).finally(
      () => {
        this.inFlight.delete(key);
      },
    );
    this.inFlight.set(key, promise);
    return promise;
  }

  private async fetchWithTimeout(
    key: string,
    from: Currency,
    to: Currency,
  ): Promise<number> {
    try {
      const response = await api.post(
        "/currency/convert",
        { amount: 1, fromCurrency: from, toCurrency: to },
        {
          timeout: this.fetchTimeoutMs,
          signal: AbortSignal.timeout(this.fetchTimeoutMs),
        },
      );
      const rate = Number(response?.data?.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`invalid rate from server: ${response?.data?.rate}`);
      }
      this.cache.set(key, { rate, fetchedAt: Date.now() });
      return rate;
    } catch (err) {
      console.warn(
        `[HttpCurrencyClient] fetch failed for ${from}->${to}; caller should fall back`,
        (err as Error)?.message ?? err,
      );
      throw err;
    }
  }

  /** Invalidate the cache (used by tests). */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const httpCurrencyClient = new HttpCurrencyClient();
