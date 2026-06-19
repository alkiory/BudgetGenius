// Shared display-translation helpers. Backend payloads carry raw English
// strings for category and recurrence enums. These helpers resolve them
// through the appropriate i18next namespace, then fall back to the raw
// string for unknown keys.

type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Resolve a raw backend category string ("Food", "Housing", "Salary")
 * to a localized label by trying:
 *   1. `categories.<key>`        (expense enum namespace)
 *   2. `incomeCategories.<key>`  (income enum namespace)
 *   3. raw `raw` fallback
 *
 * Defensive guards (handles i18next drift modes):
 *   - explicit empty-string guard on input
 *   - `translated !== key` guard (catches default missing-key behavior
 *     and any value containing interpolation templates)
 *   - `translated &&` truthy guard (catches `returnEmptyString: true`)
 *   - try/catch wraps (catches a future missingKey handler that throws)
 */
export const translateCategory = (raw: string, t: TFunction): string => {
  const normalized = String(raw || "")
    .toLowerCase()
    .trim();
  if (!normalized) return raw;

  try {
    const primary = t(`categories.${normalized}`);
    if (primary && primary !== `categories.${normalized}`) {
      return primary;
    }
  } catch {
    // fall through to next tier
  }

  try {
    const secondary = t(`incomeCategories.${normalized}`);
    if (secondary && secondary !== `incomeCategories.${normalized}`) {
      return secondary;
    }
  } catch {
    // fall through to raw fallback
  }

  return raw;
};
