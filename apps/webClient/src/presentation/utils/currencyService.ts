export type Currency = "USD" | "EUR" | "COP";

/**
 * App-wide default currency (Euro), preselected by the onboarding
 * wizard. The user's saved `user_settings.currency` overrides it for
 * display; amounts are never converted, only formatted with the chosen
 * symbol and precision.
 */
export const APP_CURRENCY: Currency = "EUR";

const SUPPORTED_CURRENCIES: ReadonlyArray<Currency> = ["USD", "EUR", "COP"];

export function toCurrency(value: string | undefined | null): Currency {
  return SUPPORTED_CURRENCIES.includes(value as Currency)
    ? (value as Currency)
    : APP_CURRENCY;
}

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

export interface FormattedCurrency {
  amount: number;
  symbol: string;
  formatted: string;
  isPositive: boolean;
}

export class CurrencyService {
  private static instance: CurrencyService;

  private constructor() {}

  public static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  public validateAmount(amount: number, currency: Currency): boolean {
    const decimalPlaces = CURRENCY_PRECISION_MAP[currency] ?? 2;
    const pattern =
      decimalPlaces === 0
        ? /^-?\d+$/
        : new RegExp(`^-?\\d+(\\.\\d{1,${decimalPlaces}})?$`);
    return pattern.test(amount.toString());
  }

  /** Formats an amount with the selected currency symbol without changing its numeric value. */
  public formatCurrency(
    amount: number,
    displayCurrency: Currency,
    showSign: boolean = true,
  ): FormattedCurrency {
    const magnitude = Math.abs(amount);
    const isPositive = amount >= 0;
    const sign = showSign ? (isPositive ? "+" : "-") : "";
    // Every monetary value is rendered with exactly two decimals. The
    // formatter rounds (it never truncates or re-scales) so a stored
    // `1260.2818351105634` displays as `€1.260,28` and `-0.8239` as
    // `-€0,82`. Nothing is converted here.
    const formatted = `${
      CURRENCY_SYMBOLS[displayCurrency] || "$"
    }${magnitude.toLocaleString(
      CURRENCY_LOCALE_MAP[displayCurrency] || "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`;

    return {
      amount: magnitude,
      symbol: CURRENCY_SYMBOLS[displayCurrency] || "$",
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

    const raw = trimmed.replace(/[^.,\d-]/g, "");
    const hasDot = raw.includes(".");
    const hasComma = raw.includes(",");

    let safe = raw;
    if (hasDot && hasComma) {
      // Both separators present: the rightmost one is the decimal point
      // (`1.234,56` -> `1234.56`, `1,234.56` -> `1234.56`).
      const decimalIndex = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
      const integerPart = raw.slice(0, decimalIndex).replace(/[.,]/g, "");
      const fractionPart = raw.slice(decimalIndex + 1).replace(/[.,]/g, "");
      safe = `${integerPart}.${fractionPart}`;
    } else if (hasDot || hasComma) {
      const sep = hasDot ? "." : ",";
      const parts = raw.split(sep);
      if (parts.length > 2) {
        const sign = raw.startsWith("-") ? "-" : "";
        const unsigned = sign ? raw.slice(1) : raw;
        const unsignedParts = unsigned.split(sep);
        const isValidGrouping =
          /^\d{1,3}$/.test(unsignedParts[0]) &&
          unsignedParts.slice(1).every((part) => /^\d{3}$/.test(part));
        if (!isValidGrouping) {
          return Number.NaN;
        }
        safe = `${sign}${unsignedParts.join("")}`;
      } else {
        safe = raw.replace(",", ".");
      }
    }

    const parsed = parseFloat(safe);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  /**
   * Rounds a raw amount to the currency's decimal precision and returns
   * clean text for a form input. Keeps trailing zeros (`1500.2` → `1500.20`)
   * so the edit modal matches the table's decimal precision.
   */
  public formatAmountInput(
    amount: number | null | undefined,
    currency: Currency,
  ): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) {
      return "";
    }
    const precision = CURRENCY_PRECISION_MAP[currency] ?? 2;
    return Number(amount).toFixed(precision);
  }

  /** Rounds a numeric amount to the currency's decimal precision. */
  public roundAmount(amount: number, currency: Currency): number {
    if (!Number.isFinite(amount)) return amount;
    const precision = CURRENCY_PRECISION_MAP[currency] ?? 2;
    return Number(amount.toFixed(precision));
  }

  public getSymbol(currency: Currency): string {
    return CURRENCY_SYMBOLS[currency] || "$";
  }

  public getAvailableCurrencies(): Currency[] {
    return [...SUPPORTED_CURRENCIES];
  }
}

export const currencyService = CurrencyService.getInstance();
