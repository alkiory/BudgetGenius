import { useMemo, useState } from "react";
import { ExpenseBreakdown } from "@domain/dashboard/dashboard.entity";
import { CategoryViewToggle } from "@presentation/components/ui/category-view-toggle";
import { chartTooltipProps } from "@presentation/utils/chart-theme";
import {
  CATEGORY_GROUP_LIMIT,
  summarizeCategories,
  toCategorySlices,
} from "@presentation/utils/category-groups";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { translateCategory } from "@presentation/utils/display-translations";
import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface Props {
  total: string;
  byCategory: ExpenseBreakdown["byCategory"];
  largest: ExpenseBreakdown["largest"];
  /** User's currency from `/user-settings`; Euro until that resolves. */
  currency: Currency;
  timezone: string;
  period: string;
}

export function ExpenseCategories({
  total,
  byCategory,
  largest,
  currency,
  period,
}: Props) {
  const { t } = useTranslation();
  const [grouped, setGrouped] = useState(true);

  // One normalised slice per category (largest first, stable colours). The
  // grouped view folds everything past the limit into a single slice so a
  // long tail of categories cannot explode the donut and its labels.
  const slices = useMemo(
    () =>
      toCategorySlices(byCategory, (category) => ({
        name: category.name,
        value: category.value,
      })),
    [byCategory],
  );
  const chartData = useMemo(
    () =>
      grouped
        ? summarizeCategories(slices, CATEGORY_GROUP_LIMIT, t("charts.other"))
        : slices,
    [grouped, slices, t],
  );

  // Labels sit well outside the donut and are joined to their slice by
  // an elbow connector line. Tiny slices are skipped so their text can
  // never collide with a neighbouring label; the legend still lists them.
  const LABEL_OFFSET = 24;
  const LABEL_ELBOW = 12;
  const MIN_LABEL_PERCENT = 0.03;
  const RADIAN = Math.PI / 180;

  const labelGeometry = (props: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
  }) => {
    const { cx, cy, midAngle, outerRadius } = props;
    const side = Math.cos(-midAngle * RADIAN) >= 0 ? 1 : -1;
    const start = {
      x: cx + outerRadius * Math.cos(-midAngle * RADIAN),
      y: cy + outerRadius * Math.sin(-midAngle * RADIAN),
    };
    const elbow = {
      x: cx + (outerRadius + LABEL_OFFSET) * Math.cos(-midAngle * RADIAN),
      y: cy + (outerRadius + LABEL_OFFSET) * Math.sin(-midAngle * RADIAN),
    };
    return {
      side,
      start,
      elbow,
      end: { x: elbow.x + side * LABEL_ELBOW, y: elbow.y },
    };
  };

  const renderOutsideLabel = (props: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    percent?: number;
    name?: string;
  }) => {
    const { side, end } = labelGeometry(props);
    const { percent, name } = props;
    if (!percent || percent < MIN_LABEL_PERCENT) return null;
    const label = translateCategory(String(name ?? ""), t);
    const shortened = label.length > 12 ? `${label.slice(0, 11)}…` : label;
    return (
      <text
        x={end.x + side * 4}
        y={end.y}
        fill="currentColor"
        fontSize="0.7rem"
        textAnchor={side > 0 ? "start" : "end"}
        dominantBaseline="central"
      >
        {`${shortened} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderLabelLine = (props: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    percent?: number;
  }) => {
    const { percent } = props;
    if (!percent || percent < MIN_LABEL_PERCENT) return <g />;
    const { start, elbow, end } = labelGeometry(props);
    return (
      <polyline
        points={`${start.x},${start.y} ${elbow.x},${elbow.y} ${end.x},${end.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-slate-400 dark:text-slate-500"
      />
    );
  };

  return (
    <div className="glass-panel hover-glow rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {t("dashboard.expenseBreakdown")}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {period}
          </span>
          <CategoryViewToggle
            grouped={grouped}
            onToggle={() => setGrouped((value) => !value)}
          />
        </div>
      </div>
      {byCategory.length > 0 ? (
        <div className="h-64 text-slate-500 dark:text-slate-400">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={64}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                label={renderOutsideLabel}
                labelLine={renderLabelLine}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} name={entry.name} />
                ))}
              </Pie>
              <Tooltip
                {...chartTooltipProps}
                cursor={false}
                formatter={(v) => [
                  currencyService.formatCurrency(Number(v), currency, false)
                    .formatted,
                  t("transactions.amount"),
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                formatter={(value) => translateCategory(String(value), t)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.noData")}
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200/60 bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {t("dashboard.totalExpenses")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            {total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {t("dashboard.largestCategory")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            {largest.name}
          </p>
        </div>
      </div>
    </div>
  );
}
