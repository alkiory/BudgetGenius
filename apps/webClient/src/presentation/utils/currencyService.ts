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

  public async convertAmountAsync(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    try {
      const rate = await httpCurrencyClient.fetchRate(fromCurrency, toCurrency);
      return amount * rate;
    } catch (err) {
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
