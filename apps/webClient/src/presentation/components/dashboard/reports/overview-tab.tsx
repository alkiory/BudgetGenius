/* eslint-disable @typescript-eslint/no-explicit-any */
import { RootState } from "@adapters/store/rootStore";
import Loader from "@presentation/components/loader";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { translateCategory } from "@presentation/utils/display-translations";
import { TrendingUp, ArrowDownUp, PieChartIcon, BarChart3 } from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Pie,
  Cell,
  BarChart,
  PieChart,
} from "recharts";
import { COLORS } from "@presentation/utils/color";
import {
  chartAxisProps,
  chartGridProps,
  chartTooltipProps,
} from "@presentation/utils/chart-theme";
import { ChartContainer } from "./inner-componets";
import SummaryCard from "./summary-card";

interface OverviewTabProps {
  isLoadingOverview: boolean;
  isLoadingInsights: boolean;
  highestSpendingMonth: any;
  timeframe: string;
  timeframeText: Record<string, string>;
  overview: any;
  totalIncome: number;
  totalExpenses: number;
  savingsAmount: number;
  savingsRate: number;
  topCategory: any;
  categories: any;
  insights: any;
}

export default function OverviewTab({
  isLoadingOverview,
  isLoadingInsights,
  highestSpendingMonth,
  timeframe,
  timeframeText,
  overview,
  totalIncome,
  totalExpenses,
  savingsAmount,
  savingsRate,
  topCategory,
  categories,
  insights,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;
  const targetCurrency = (settings?.currency || "EUR") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, targetCurrency, false).formatted;

  return (
    <div className="space-y-6">
      {isLoadingOverview && <Loader />}
      <div className="grid gap-6 md:grid-cols-4">
        <SummaryCard
          title={t("reports.totalIncome")}
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          color="green"
          subtitle={timeframeText[timeframe]}
        />

        <SummaryCard
          title={t("reports.totalExpenses")}
          value={formatCurrency(totalExpenses)}
          icon={ArrowDownUp}
          color="red"
          subtitle={timeframeText[timeframe]}
        />

        <SummaryCard
          title={t("reports.savings")}
          value={formatCurrency(savingsAmount)}
          icon={PieChartIcon}
          color="blue"
          subtitle={`${savingsRate}% ${t("reports.ofIncomeSaved")}`}
        />

        <SummaryCard
          title={t("reports.topSpending")}
          value={topCategory?.category || t("reports.nA")}
          icon={BarChart3}
          color="teal"
          subtitle={
            topCategory
              ? formatCurrency(topCategory.amount) + " " + t("reports.spent")
              : ""
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartContainer title={t("reports.incomeExpensesTab")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview?.monthly || []}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip
                {...chartTooltipProps}
                formatter={(value) => [formatCurrency(Number(value)), ""]}
              />
              <Legend />
              <Bar
                dataKey="income"
                name={t("reports.totalIncome")}
                fill="#10b981"
              />
              <Bar
                dataKey="expenses"
                name={t("reports.totalExpenses")}
                fill="#f43f5e"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title={t("reports.spendingByCategory")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories || []}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={80}
                label={false}
                labelLine={false}
              >
                {categories?.map(
                  (
                    entry: { amount: number; category: string; color?: string },
                    index: number,
                  ) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || COLORS[index % COLORS.length]}
                    />
                  ),
                )}
              </Pie>
              <Tooltip
                {...chartTooltipProps}
                cursor={false}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Legend
                formatter={(value) => translateCategory(String(value), t)}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Insights */}
      {isLoadingInsights && <Loader />}
      {insights && (
        <div className="glass-panel hover-glow rounded-xl p-6">
          <h3 className="mb-4 text-lg font-medium">
            {t("reports.financialInsights")}
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200/70 bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("reports.highestSpendingMonthLabel")}
              </h4>
              <p className="mt-1 text-2xl font-bold">
                {highestSpendingMonth?.month}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(highestSpendingMonth?.expenses)}{" "}
                {t("reports.spent")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("reports.averageMonthlyExpenses")}
              </h4>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(insights.data.averageAmountExpenses)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("reports.perMonth")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("reports.expenseToIncomeRatio")}
              </h4>
              <p className="mt-1 text-2xl font-bold">
                {Math.round(insights.data.expenseToIncomeRatio)}%
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("reports.lowerIsBetter")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
