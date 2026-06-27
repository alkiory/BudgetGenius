import {
  Currency,
  CURRENCY_LOCALE_MAP,
  CURRENCY_PRECISION_MAP,
  currencyService,
} from "@presentation/utils/currencyService";
import { useState } from "react";

interface UseDecimalInputOptions {
  /** Initial numeric value (or undefined for blank). */
  initial?: number;
  /** Currency code — drives locale + decimal precision. */
  currency: Currency;
}

interface UseDecimalInputReturn {
  /** Raw text buffer; bind to `<input value={text} onChange=…>`. */
  text: string;
  /** Setter for the raw buffer; accepts a string change event value. */
  setText: (next: string) => void;
  /**
   * Parsed numeric value (or `NaN` for empty / invalid). Call this at
   * submit time — never assume the live text buffer is a valid number.
   */
  parseNumber: () => number;
  /**
   * `true` when the buffer would parse to a finite, non-NaN number.
   * Cheaper than `parseNumber()` if you only need a boolean.
   */
  isValid: () => boolean;
  /**
   * `Intl`-formatted preview string for the parsed number, rendered
   * with the user's currency + locale. `""` when the buffer is empty
   * or invalid.
   */
  livePreview: () => string;
  /** Decimal precision for the active currency (0 for COP, 2 for USD/EUR). */
  precision: number;
  /** Locale string this input should be paired with (en-US, es-ES, es-CO). */
  locale: string;
  /** Currency symbol used by the parent input prefix (matches the
   *  `currencyService.getSymbol()` call the consumer was already making). */
  symbol: string;
}

export function useDecimalInput(
  options: UseDecimalInputOptions,
): UseDecimalInputReturn {
  const { initial, currency } = options;
  const [text, setText] = useState<string>(
    initial === undefined || !Number.isFinite(initial) ? "" : String(initial),
  );

  // Memoised per-render so each getter is stable enough to call inline
  // in JSX without re-running the lookup; cheap because the maps are
  // tiny (3 entries).
  const precision = CURRENCY_PRECISION_MAP[currency] ?? 2;
  const locale = CURRENCY_LOCALE_MAP[currency] ?? "en-US";
  const symbol = currencyService.getSymbol(currency);

  const parseNumber = (): number => {
    return currencyService.parseAmountInput(text);
  };

  const isValid = (): boolean => {
    const n = parseNumber();
    return Number.isFinite(n);
  };

  const livePreview = (): string => {
    const n = parseNumber();
    if (!Number.isFinite(n)) return "";
    try {
      return n.toLocaleString(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });
    } catch {
      // Fallback for unrecognised locales (shouldn't trigger — the maps
      // are controlled — but Intl is permitted to throw on exotic values).
      return String(n);
    }
  };

  return {
    text,
    setText,
    parseNumber,
    isValid,
    livePreview,
    precision,
    locale,
    symbol,
  };
}
