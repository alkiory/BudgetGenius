import { COLORS } from "./color";

/** One normalised slice of a category donut. */
export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

/** Individual categories kept visible before the rest are folded together. */
export const CATEGORY_GROUP_LIMIT = 6;

/** Neutral colour for the aggregated slice, so it reads as a residual. */
const OTHER_COLOR = "#64748b";

/**
 * Normalise a category breakdown into slices ordered largest first, giving
 * every slice a colour from the shared palette. Colours are assigned before
 * sorting, so a category keeps the same colour when the chart switches
 * between the grouped and the expanded view.
 */
export function toCategorySlices<T>(
  items: T[],
  read: (
    item: T,
    index: number,
  ) => { name: string; value: number; color?: string },
): CategorySlice[] {
  return items
    .map((item, index) => {
      const { name, value, color } = read(item, index);
      return { name, value, color: color || COLORS[index % COLORS.length] };
    })
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * Keep the `limit` largest categories and fold the remainder into a single
 * slice. Returns the input untouched when there is nothing worth grouping
 * (few categories, or only one would be merged).
 */
export function summarizeCategories(
  slices: CategorySlice[],
  limit = CATEGORY_GROUP_LIMIT,
  otherLabel = "Other",
): CategorySlice[] {
  if (slices.length <= limit + 1) return slices;

  const rest = slices.slice(limit);
  const value = rest.reduce((sum, slice) => sum + slice.value, 0);
  if (value <= 0) return slices;

  return [
    ...slices.slice(0, limit),
    { name: otherLabel, value, color: OTHER_COLOR },
  ];
}
