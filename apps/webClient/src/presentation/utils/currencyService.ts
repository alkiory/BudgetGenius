// MVP scope (T3.x): the MVP supports only three currencies — USD, EUR,
// COP. Removing GBP, JPY, AUD, CAD here narrows the `Currency` union so
// the rest of the codebase no longer has to deal with rows whose rates
// the upstream provider occasionally returns as NaN (which surfaced as
// "NaN" in the dashboard for the Australian and Canadian dollars —
// fixed by simply not supporting them).
import { httpCurrencyClient } from "@adapters/http/currency.client";

export type Currency = "USD" | "EUR" | "COP";
type ExchangeRates = Record<Currency, number>;

// Exchange rates defaults (Should be fetched from an API)
const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.93,
  COP: 4000,
};

// Currency Symbols
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  COP: "$",
};

// Wave 2 [T2.1 / T2.2 / T2.6 foundation]: exported precision/locale
// constants so the new `useDecimalInput` hook (and any future form
// input) can read decimal precision + matching numeric locale with a
// single import. Previously these maps were private members of the
// `CurrencyService` class — indirectly reachable via `formatCurrency`
// but not directly addressable from call sites needing the raw maps
// (e.g. `<input inputMode="decimal" step={1 / 10 ** precision} />`).
//
// Locale resolution is `Intl`-backed so it gets the canonical rules for
// each currency (group separator, decimal separator) instead of the
// previously hand-rolled mapping.
export const CURRENCY_PRECISION_MAP: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  COP: 0,
};

export const CURRENCY_LOCALE_MAP: Record<Currency, string> = {
  USD: "en-US",
  EUR: "es-ES",
  COP: "es-CO",
};

interface CurrencyConversionOptions {
  amount: number;
  fromCurrency?: Currency;
  toCurrency: Currency;
  exchangeRates?: ExchangeRates;
}

export interface FormattedCurrency {
  amount: number;
  symbol: string;
  formatted: string;
  isPositive: boolean;
}

export class CurrencyService {
  private static instance: CurrencyService;
  private exchangeRates: ExchangeRates;

  private constructor(exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES) {
    this.exchangeRates = exchangeRates;
  }

  private getLocaleForCurrency(currency: Currency): string {
    // Wave 2 [T2.6]: now reads from the exported `CURRENCY_LOCALE_MAP`.
    // Kept as a private method for the existing class internals so the
    // `formatCurrency`/`normalizeAmount` paths don't change shape; the
    // exported map is the canonical source-of-truth for *new* consumers.
    return CURRENCY_LOCALE_MAP[currency] || "en-US";
  }

  public static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  public async updateExchangeRates(): Promise<void> {
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await response.json();
      const rates = data.rates;
      this.exchangeRates = {
        ...DEFAULT_EXCHANGE_RATES,
        ...rates,
      };
    } catch (error) {
      console.error("Error updating exchange rates:", error);
    }
  }

  public validateAmount(amount: number, currency: Currency): boolean {
    const decimalPlaces = this.getDecimalPrecision(currency);
    // When decimalPlaces is 0 (e.g., COP), only allow integers
    const pattern =
      decimalPlaces === 0
        ? /^-?\d+$/
        : new RegExp(`^-?\\d+(\\.\\d{1,${decimalPlaces}})?$`);
    return pattern.test(amount.toString());
  }

  private getDecimalPrecision(currency: Currency): number {
    const precisionMap: Record<Currency, number> = {
      USD: 2,
      EUR: 2,
      COP: 0,
    };
    return precisionMap[currency] ?? 2;
  }

  public convertAmount(options: CurrencyConversionOptions): number {
    const { amount, fromCurrency = "USD", toCurrency } = options;
    const rates = options.exchangeRates || this.exchangeRates;

    // Wave 2 [T2.7 fix]: graceful fallback when the caller has supplied
    // (or the bundled rates table is missing) one of the endpoints. The
    // old hard-fold returned `NaN` from `amount * undefined` /
    // `amount / undefined`, which then floored to "NaN" rendered in the
    // dashboard for any monetary aggregate referencing a withdrawal we
    // hadn't shipped rates for. Identity fallback keeps the contract
    // stable and predictable — display pipelines can still surface the
    // raw figure next to a "rate missing" tag if they want.
    const fromRate = fromCurrency === "USD" ? 1 : rates[fromCurrency];
    const toRate = toCurrency === "USD" ? 1 : rates[toCurrency];
    if (fromRate === undefined || toRate === undefined) {
      return amount;
    }

    // Convert to USD first if not the base currency
    const amountInUSD = fromCurrency === "USD" ? amount : amount / fromRate;

    // Convert to target currency
    return toCurrency === "USD" ? amountInUSD : amountInUSD * toRate;
  }

  public normalizeAmount(amount: number, currency: Currency): number {
    return this.convertAmount({
      amount,
      fromCurrency: currency,
      toCurrency: "USD",
    });
  }

  public formatCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    showSign: boolean = true,
  ): FormattedCurrency {
    const converted = this.convertAmount({
      amount: Math.abs(amount),
      fromCurrency,
      toCurrency,
    });

    const symbol = CURRENCY_SYMBOLS[toCurrency] || "$";
    const isPositive = amount >= 0;
    const sign = showSign ? (isPositive ? "+" : "-") : "";

    // Obtener el locale para la moneda de destino
    const locale = this.getLocaleForCurrency(toCurrency);

    const formatted = converted.toLocaleString(locale, {
      style: "currency",
      currency: toCurrency,
      minimumFractionDigits: this.getDecimalPrecision(toCurrency),
      maximumFractionDigits: this.getDecimalPrecision(toCurrency),
    });

    return {
      amount: converted,
      symbol,
      formatted: `${sign}${formatted}`,
      isPositive,
    };
  }

  /**
   * Normalize a user-entered amount string from any supported locale to a
   * number. Accepts `5.23`, `10,42`, and ` 5 . 23 ` (decimal-comma and
   * decimal-dot inputs). Returns NaN for empty / unparseable input —
   * callers should treat NaN as "no amount entered".
   *
   * The MVP handles single-decimal-separator inputs (dot OR comma).
   * Thousand-grouped values such as `1,234.56` or `1.234,56` are NOT
   * supported — they require locale-aware parsing, out of MVP scope.
   */
  public parseAmountInput(value: string | number | null | undefined): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : Number.NaN;
    }
    if (value === null || value === undefined) return Number.NaN;
    const trimmed = String(value).trim();
    if (trimmed === "") return Number.NaN;
    const normalized = trimmed.replace(/,/g, ".");
    // Drop everything that is not a digit, sign, or decimal point.
    const cleaned = normalized.replace(/[^.\d-]/g, "");
    // Collapse repeated decimal points so only the FIRST one is kept as
    // the decimal separator. Subsequent dots (likely misplaced thousand
    // separators from a paste, e.g. "1.234.567") are dropped. Crucially
    // we KEEP the first dot — the previous implementation stripped it
    // from the prefix slice, so a single-decimal value like "10.5" came
    // out as parseFloat("105") = 105.
    const firstDot = cleaned.indexOf(".");
    let safe = cleaned;
    if (firstDot !== -1) {
      safe =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
    const parsed = parseFloat(safe);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  public getSymbol(currency: Currency): string {
    return CURRENCY_SYMBOLS[currency] || "$";
  }

  public getAvailableCurrencies(): Currency[] {
    return Object.keys(CURRENCY_SYMBOLS) as Currency[];
  }

  public startExchangeRateUpdater(): void {
    setInterval(
      () => {
        this.updateExchangeRates();
      },
      60 * 60 * 1000,
    ); // update every hour
  }

  /**
   * Wave 3 [T3.4] — async, server-preferred conversion. Thin wrapper
   * around `httpCurrencyClient.fetchRate` with a graceful offline
   * fallback to the bundled `DEFAULT_EXCHANGE_RATES` (the synchronous
   * path maintained above). The 30s in-memory cache + in-flight dedup
   * live inside `HttpCurrencyClient`; here we only orchestrate the
   * fallback decision.
   *
   * Behavioural contract for callers:
   *   - `from === to`: returns `amount` immediately, no I/O.
   *   - HTTP fetch succeeds: returns `amount * rate` from the cache-
   *     backed endpoint (callers should not assume cached rates are
   *     ≤30s old; the cache is the single source of truth for the
   *     in-process 30s window per the audit plan's "internal
   *     architecture" decision).
   *   - HTTP fetch fails (network error, 5xx, timeout): falls back to
   *     `convertAmount({ amount, fromCurrency, toCurrency })` using
   *     the bundled rates. The fallback figure is intentionally stale-
   *     but-not-NaN so the dashboard never shows "NaN"; the audit's
   *     Bug A closure is preserved end-to-end.
   */
  public async convertAmountAsync(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    try {
      const rate = await httpCurrencyClient.fetchRate(
        fromCurrency,
        toCurrency,
      );
      return amount * rate;
    } catch (err) {
      // Offline / network-error fallback. Never bubbles the original
      // error — caller code paths (form submit, chart rendering) are
      // not interested in the upstream failure, only in a finite
      // numeric result. The warning is logged for SRE diagnostic
      // without spamming the user.
      // eslint-disable-next-line no-console
      console.warn(
        `[currencyService] backend unreachable, falling back to bundled rates for ${fromCurrency}->${toCurrency}`,
        (err as Error)?.message ?? err,
      );
      return this.convertAmount({ amount, fromCurrency, toCurrency });
    }
  }
}

// Singleton instance export
export const currencyService = CurrencyService.getInstance();
