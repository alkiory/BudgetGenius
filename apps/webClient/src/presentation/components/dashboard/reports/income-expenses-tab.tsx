/* eslint-disable @typescript-eslint/no-explicit-any */
import { RootState } from "@adapters/store/rootStore";
import Loader from "@presentation/components/loader";
import { Currency, currencyService } from "@presentation/utils/currencyService";
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
  Line,
  BarChart,
  LineChart,
} from "recharts";
import {
  chartAxisProps,
  chartGridProps,
  chartLineTooltipProps,
  chartTooltipProps,
} from "@presentation/utils/chart-theme";
import { ChartContainer, ProgressBar, InsightBox } from "./inner-componets";

interface IncomeExpensesTabProps {
  overview: any;
  isLoadingInsights: boolean;
  insights: any;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  savings: any;
}
export default function IncomeExpensesTab({
  isLoadingInsights,
  overview,
  insights,
  totalIncome,
  totalExpenses,
  savingsRate,
  savings,
}: IncomeExpensesTabProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;
  const targetCurrency = (settings?.currency || "EUR") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, targetCurrency, false).formatted;

  return (
    <div className="space-y-6">
      <ChartContainer title={t("reports.monthlyIncomeVsExpenses")}>
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

      {/* Ratios */}
      {isLoadingInsights && <Loader />}
      {overview && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass-panel hover-glow rounded-xl p-6">
            <h3 className="mb-4 text-lg font-medium">
              {t("reports.incomeBreakdown")}
            </h3>
            <div className="space-y-4">
              {overview?.incomeSources?.length ? (
                overview.incomeSources.map((source: any) => (
                  <div key={source.category}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{source.category}</span>
                      <span>{formatCurrency(source.amount)}</span>
                    </div>
                    <ProgressBar
                      value={totalIncome > 0 ? (source.amount / totalIncome) * 100 : 0}
                      color="#10b981"
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("common.noData")}
                </p>
              )}
            </div>
          </div>

          <ChartContainer title={t("reports.savingsGrowth")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savings?.monthly || []}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip
                  {...chartLineTooltipProps}
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    t("transactions.amount"),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="#10b981"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {insights && (
        <div className="glass-panel hover-glow rounded-xl p-6">
          <h3 className="mb-4 text-lg font-medium">
            {t("reports.financialRatios")}
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            <InsightBox
              title={t("reports.incomeRatio")}
              value={`${Math.round(
                (totalIncome / (totalIncome + totalExpenses)) * 100,
              )}%`}
              description={t("reports.percentageOfCashFlow")}
            />
            <InsightBox
              title={t("reports.expensesRatio")}
              value={`${Math.round(
                (totalExpenses / (totalIncome + totalExpenses)) * 100,
              )}%`}
              description={t("reports.percentageOfCashFlow")}
            />
            <InsightBox
              title={t("reports.savingsRate")}
              value={`${savingsRate}%`}
              description={t("reports.ofIncomeSavedShort")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
