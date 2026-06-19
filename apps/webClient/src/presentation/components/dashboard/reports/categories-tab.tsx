import { RootState } from "@adapters/store/rootStore";
import Loader from "@presentation/components/loader";
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
import { ChartContainer, ProgressBar, InsightBox } from "./inner-componets";

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  const targetCurrency = (settings?.currency || "USD") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(
      value,
      "USD" as Currency,
      targetCurrency,
      false,
    ).formatted;
  return (
    <div className="space-y-6">
      {isLoadingInsights && <Loader />}
      {categories && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartContainer title={t("reports.spendingByCategory")}>
            {/*
              Phase 6.8 (Polish): the wrapper `<div>` carries a Tailwind
              text-color class that the SVG `<text>` labels inherit
              through `fill="currentColor"`. This guarantees the labels
              read as high-contrast slate text (light + dark mode) and
              NOT the cell fill color (which previously made labels
              'blend into the chart'). The labels also sit at
              `outerRadius + 18` to reduce slice-to-label overlap.
            */}
            <div className="h-full w-full text-slate-700 dark:text-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({
                      category,
                      percent,
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                    }: any) => {
                      const RADIAN = Math.PI / 180;
                      const radius = (outerRadius ?? 75) + 18;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const translated = translateCategory(category, t);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="currentColor"
                          fontSize="0.75rem"
                          fontWeight={500}
                          textAnchor={x > cx ? "start" : "end"}
                          dominantBaseline="central"
                          className="text-xs font-medium"
                        >
                          {`${translated} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {categories?.map((entry: any, index: string) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || "#8b5cf6"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-medium">
              {t("reports.categoryBreakdown")}
            </h3>
            <div className="space-y-4">
              {categories?.map((category: any) => {
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
                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: category.color || "#8b5cf6",
                          }}
                        />
                        <span className="font-medium">
                          {translateCategory(category.category, t)}
                        </span>
                      </div>
                      <span>{formatCurrency(category.amount)}</span>
                    </div>
                    <ProgressBar
                      value={percentUsed}
                      color={category.color || "#8b5cf6"}
                    />
                    {isOver && (
                      <p className="mt-1 text-xs font-medium text-red-500 dark:text-red-400">
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
            <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
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
              <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
                <h3 className="mb-4 text-lg font-medium">
                  {t("reports.recommendations")}
                </h3>
                <div className="space-y-4">
                  {insights.recommendations.map((rec: any) => (
                    <div
                      key={rec.category}
                      className={`rounded-lg border p-4 ${
                        rec.priority === "high"
                          ? "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10"
                          : rec.priority === "medium"
                          ? "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10"
                          : "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10"
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
