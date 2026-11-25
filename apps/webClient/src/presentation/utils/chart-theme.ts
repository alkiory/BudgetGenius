import type { CSSProperties } from "react";

/**
 * Recharts theming derived from the app's semantic tokens. Recharts'
 * defaults (white tooltip, #ccc hover band, grey grid) are the only
 * surfaces that ignored the rebranding palette and looked broken in dark
 * mode, so every chart spreads these props instead of restyling ad hoc.
 */
const TOOLTIP_BASE: CSSProperties = {
  background: "rgb(var(--card) / 0.97)",
  border: "1px solid rgb(var(--border) / 0.9)",
  borderRadius: "0.75rem",
  color: "rgb(var(--card-foreground))",
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 18px 40px -20px rgb(0 0 0 / 0.65)",
};

const TOOLTIP_ITEM: CSSProperties = {
  color: "rgb(var(--card-foreground))",
  fontSize: 12,
};

const TOOLTIP_LABEL: CSSProperties = {
  color: "rgb(var(--muted-foreground))",
  fontSize: 11,
  marginBottom: 4,
};

export const chartTooltipProps = {
  contentStyle: TOOLTIP_BASE,
  itemStyle: TOOLTIP_ITEM,
  labelStyle: TOOLTIP_LABEL,
  /** Soft band behind the hovered bar group instead of Recharts' grey. */
  cursor: { fill: "rgb(148 163 184 / 0.08)" },
};

export const chartLineTooltipProps = {
  contentStyle: TOOLTIP_BASE,
  itemStyle: TOOLTIP_ITEM,
  labelStyle: TOOLTIP_LABEL,
  cursor: { stroke: "rgb(148 163 184 / 0.35)", strokeWidth: 1 },
};

export const chartGridProps = {
  stroke: "rgb(148 163 184 / 0.16)",
  strokeDasharray: "3 3",
  vertical: false,
};

export const chartAxisProps = {
  tick: { fill: "rgb(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: false,
  stroke: "rgb(148 163 184 / 0.45)",
};

/** Card shell used by the report/budget panels. */
export const chartCardClass = "glass-panel hover-glow rounded-xl p-6";
