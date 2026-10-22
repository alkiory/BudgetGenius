import { ExpenseBreakdown } from "@domain/dashboard/dashboard.entity";
import { COLORS } from "@presentation/utils/color";
import {
  APP_CURRENCY,
  currencyService,
} from "@presentation/utils/currencyService";
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
  timezone: string;
  period: string;
}

export function ExpenseCategories({
  total,
  byCategory,
  largest,
  period,
}: Props) {
  const { t } = useTranslation();

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
    const label = String(name ?? "");
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
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {t("dashboard.expenseBreakdown")}
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {period}
        </span>
      </div>
      {byCategory.length > 0 ? (
        <div className="h-64 text-slate-700 dark:text-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byCategory}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={64}
                paddingAngle={2}
                dataKey="value"
                label={renderOutsideLabel}
                labelLine={renderLabelLine}
              >
                {byCategory?.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    name={entry.name}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [
                  currencyService.formatCurrency(Number(v), APP_CURRENCY, false)
                    .formatted,
                  t("transactions.amount"),
                ]}
              />
              <Legend />
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
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-700">
          <p className="text-sm text-slate-500">
            {t("dashboard.totalExpenses")}
          </p>
          <p className="text-xl font-bold">{total}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-700">
          <p className="text-sm text-slate-500">
            {t("dashboard.largestCategory")}
          </p>
          <p className="text-xl font-bold">{largest.name}</p>
        </div>
      </div>
    </div>
  );
}
