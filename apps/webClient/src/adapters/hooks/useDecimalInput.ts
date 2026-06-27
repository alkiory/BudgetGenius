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

/**
 * Raw text buffer + locale-aware helpers for a single decimal input.
 *
 * @remarks
 *
 * **`initial` is read once on mount.** The hook does NOT subscribe
 * to `initial` changes after mount — the text buffer is the source
 * of truth for the in-flight edit. If the parent's stored value
 * changes from outside the hook, the buffer will not auto-sync.
 *
 * Consumers that need to re-sync (reset on cancel, re-pull from a
 * parent refetch, etc.) must call `setText` explicitly. The
 * legitimate ways to re-initialize the buffer are:
 *
 * 1. **Component remount via React `key`** — when the parent's
 *    `key` changes, React unmounts the old component and mounts a
 *    fresh one, which re-reads `initial` on mount.
 * 2. **Explicit `setText(...)`** — call from an event handler
 *    (e.g. a "Reset" button or a cancel action).
 *
 * Do NOT add a `useEffect(() => allocatedInput.setText(String(category.allocated)),
 * [category.allocated])` to push the prop back into the buffer — that
 * will fight the controlled `<input value={text} …>` and create an
 * infinite render loop (the effect fires → `setText` → re-render →
 * effect fires again).
 *
 * @example
 *   const amount = useDecimalInput({ initial: 0, currency: "USD" });
 *   <input value={amount.text} onChange={(e) => amount.setText(e.target.value)} />
 *   <button onClick={() => api.save({ amount: amount.parseNumber() })} />
 */
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
