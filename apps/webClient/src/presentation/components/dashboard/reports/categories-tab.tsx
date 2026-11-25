import { useMemo, useState } from "react";
import { RootState } from "@adapters/store/rootStore";
import Loader from "@presentation/components/loader";
import { CategoryViewToggle } from "@presentation/components/ui/category-view-toggle";
import {
  CATEGORY_GROUP_LIMIT,
  summarizeCategories,
  toCategorySlices,
} from "@presentation/utils/category-groups";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { translateCategory } from "@presentation/utils/display-translations";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  ResponsiveContainer,
  Pie,
  Cell,
  Tooltip,
  Legend,
  PieChart,
} from "recharts";
import { COLORS } from "@presentation/utils/color";
import { chartTooltipProps } from "@presentation/utils/chart-theme";
import { ChartContainer, ProgressBar, InsightBox } from "./inner-componets";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RADIAN = Math.PI / 180;
// Distance from the arc to the label's elbow, then the horizontal run
// that carries the text away from the pie. The label sits at the end of
// this connector line, keeping it clear of the slices.
const LABEL_OFFSET = 30;
const LABEL_ELBOW = 18;
// Slices smaller than this are skipped to avoid text collisions; their
// data is still available in the legend and the breakdown panel.
const MIN_LABEL_PERCENT = 0.03;


interface TrendsTabProps {
  isLoadingInsights: boolean;
  weeklyTrend: any[];
  totalExpenses: any;
  insights: any;
  categories: any;
} // Phase 6.8 (Polish): raw backend category strings ("Food", "Salary",
// ...) are resolved to localized labels via the shared helper at
// `@presentation/utils/display-translations.ts`. That module
// documents the three defensive guards (key mismatch, empty-string,
// try/catch) used to survive i18next drift modes.

export default function CategoryTab({
  isLoadingInsights,
  categories,
  insights,
  totalExpenses,
}: TrendsTabProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;
  const targetCurrency = (settings?.currency || "EUR") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, targetCurrency, false).formatted;

  const [grouped, setGrouped] = useState(true);

  // Default view: biggest categories plus one "others" slice. The full list
  // stays one click away, and the breakdown panel below keeps every category.
  const slices = useMemo(
    () =>
      toCategorySlices(categories ?? [], (entry: any) => ({
        name: translateCategory(String(entry.category ?? entry.name ?? ""), t),
        value: Number(entry.amount) || 0,
        color: entry.color,
      })),
    [categories, t],
  );
  const categoryData = useMemo(
    () =>
      grouped
        ? summarizeCategories(slices, CATEGORY_GROUP_LIMIT, t("charts.other"))
        : slices,
    [grouped, slices, t],
  );

  const labelGeometry = (props: any) => {
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

  const renderOutsideLabel = (props: any) => {
    const { percent } = props;
    if (!percent || percent < MIN_LABEL_PERCENT) return null;
    const { side, end } = labelGeometry(props);
    const fullLabel = String(props.name ?? "");
    const shortened =
      fullLabel.length > 14 ? `${fullLabel.slice(0, 13)}…` : fullLabel;
    const textX = end.x + side * 4;
    const textAnchor = side > 0 ? "start" : "end";
    return (
      <text
        x={textX}
        y={end.y}
        fill="currentColor"
        fontSize="0.7rem"
        textAnchor={textAnchor}
        dominantBaseline="central"
      >
        <tspan x={textX} dy="-0.45em">
          {shortened}
        </tspan>
        <tspan x={textX} dy="1.1em" fontWeight={600}>
          {`${(percent * 100).toFixed(0)}%`}
        </tspan>
      </text>
    );
  };

  const renderLabelLine = (props: any) => {
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
    <div className="space-y-6">
      {isLoadingInsights && <Loader />}
      {categories && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartContainer
            title={t("reports.spendingByCategory")}
            action={
              <CategoryViewToggle
                grouped={grouped}
                onToggle={() => setGrouped((value) => !value)}
              />
            }
          >
            <div className="h-full w-full text-slate-700 dark:text-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    outerRadius={58}
                    label={renderOutsideLabel}
                    labelLine={renderLabelLine}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltipProps}
                    cursor={false}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => String(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>

          <div className="glass-panel hover-glow rounded-xl p-6">
            <h3 className="mb-4 text-lg font-medium">
              {t("reports.categoryBreakdown")}
            </h3>
            <div className="space-y-4">
              {categories?.map((category: any, index: number) => {
                // Phase 6.8 (over-budget polish): compute the percentage
                // once and surface the "over by X%" signal when the
                // category's spend exceeds its share of the total. The
                // ProgressBar component itself flips to red when over;
                // this label gives the user the exact amount over.
                const percentUsed =
                  totalExpenses > 0
                    ? (category.amount / totalExpenses) * 100
                    : 0;
                const isOver = percentUsed > 100;
                const overBy = Math.max(0, percentUsed - 100);
                const categoryColor =
                  category.color || COLORS[index % COLORS.length];
                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <span className="font-medium">
                          {translateCategory(category.category, t)}
                        </span>
                      </div>
                      <span>{formatCurrency(category.amount)}</span>
                    </div>
                    <ProgressBar value={percentUsed} color={categoryColor} />
                    {isOver && (
                      <p className="mt-1 text-xs font-medium text-rose-500 dark:text-rose-400">
                        {t("reports.overByPercent", {
                          percent: overBy.toFixed(1),
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {insights &&
        (insights.recommendations?.length > 0 ||
          insights.topCategory !== undefined) && (
          <div className="space-y-6">
            <div className="glass-panel hover-glow rounded-xl p-6">
              <h3 className="mb-4 text-lg font-medium">
                {t("reports.categoryInsights")}
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {insights.topCategory && (
                  <InsightBox
                    title={t("reports.topCategory")}
                    value={insights.topCategory.name}
                    description={`${formatCurrency(
                      insights.topCategory.amount,
                    )} ${t("reports.spent")}`}
                  />
                )}
                {insights.fastestGrowingCategory && (
                  <InsightBox
                    title={t("reports.fastestGrowing")}
                    value={insights.fastestGrowingCategory.name}
                    description={`+${
                      insights.fastestGrowingCategory.growth
                    }% ${t("reports.fromLastPeriod")}`}
                  />
                )}
                {insights.mostImprovedCategory && (
                  <InsightBox
                    title={t("reports.mostImproved")}
                    value={insights.mostImprovedCategory.name}
                    description={`-${
                      insights.mostImprovedCategory.reduction
                    }% ${t("reports.reduction")}`}
                  />
                )}
              </div>
            </div>

            {insights.recommendations?.length > 0 && (
              <div className="glass-panel hover-glow rounded-xl p-6">
                <h3 className="mb-4 text-lg font-medium">
                  {t("reports.recommendations")}
                </h3>
                <div className="space-y-4">
                  {insights.recommendations.map((rec: any) => (
                    <div
                      key={rec.category}
                      className={`rounded-lg border p-4 ${
                        rec.priority === "high"
                          ? "border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10"
                          : rec.priority === "medium"
                          ? "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10"
                          : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10"
                      }`}
                    >
                      <h4 className="font-medium">{rec.category}</h4>
                      <p className="mt-1 text-sm">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
