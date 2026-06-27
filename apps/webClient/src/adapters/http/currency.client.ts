import api from "@infrastructure/api.config";

import type { Currency } from "@presentation/utils/currencyService";

/**
 * Wave 3 [T3.4] — frontend client for the backend
 * `POST /currency/convert` endpoint exposed by `apps/api`'s
 * `CurrencyController`.
 *
 * Design (per audit / open-question 1 "Architecture: interna"):
 *   - 30s in-memory cache keyed by `${from}->${to}` to match React
 *     Query's `staleTime: 30 * 1000` configured in `dashboard.tsx`
 *     (Wave 2 [T2.8]).
 *   - In-flight dedup: 5 forms submitting within the same 30s window
 *     share one fetch promise instead of firing 5 redundant
 *     requests. This is the same pattern as the React Query
 *     `queryKey` deduplication but operates pre-query because we have
 *     a non-React-Query call site (`convertAmountAsync`).
 *   - On network failure (offline / 5xx / timeout): the caller is
 *     expected to fall back to a synchronous path. The error rethrows
 *     verbatim so `currencyService.convertAmountAsync` can detect
 *     the failure and dispatch the bundled fallback. We do NOT
 *     swallow the error here because callers need to log/silence
 *     internally.
 *
 * NOTE: this client deliberately does NOT export a "forceRefresh"
 * option. Operators wanting to invalidate the cache should restart
 * the dev server / call `currencyService.updateExchangeRates()`
 * (which sets the bundled rates) instead of bypassing the cache —
 * the cache is the single source of truth for the in-process
 * 30s window. Bypassing it would let inconsistent rates leak into
 * charts.
 */
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
      // Send amount=1 so the response's `rate` field is the direct
      // multiplicative conversion (1 USD = X EUR). The server's
      // response shape is documented in ConvertCurrencyResponseDto.
      // Wave 3 [T3.4]: wire both `timeout` (axios) and an explicit
      // `signal` so a wedged backend can't make the offline
      // fallback unreachable. Without this, the previous
      // implementation used axios's default infinite timeout — if
      // the backend hung in a slow handler, the offline fallback
      // (per currencyService.convertAmountAsync) would never
      // engage and the dashboard would sit on a spinner
      // indefinitely.
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
      // T3.4: clear the in-flight marker (finally does this) so a
      // subsequent retry can fire; do NOT cache the failure (negative
      // cache entries would block the offline fallback when the
      // network comes back). Log a console warning so devtools
      // surfaces the diagnostic without spamming the user.
      // eslint-disable-next-line no-console
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

/**
 * Shared singleton — process-wide. The 30s cache + in-flight dedup are
 * reference-stable so a singleton is safe across the SPA without
 * recreating per-component-instance.
 */
export const httpCurrencyClient = new HttpCurrencyClient();
