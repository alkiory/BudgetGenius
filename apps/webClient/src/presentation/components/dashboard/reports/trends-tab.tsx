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
  Line,
  Bar,
  LineChart,
  BarChart,
} from "recharts";
import {
  chartAxisProps,
  chartGridProps,
  chartLineTooltipProps,
  chartTooltipProps,
} from "@presentation/utils/chart-theme";
import { ChartContainer, InsightBox } from "./inner-componets";

interface TrendsTabProps {
  isLoadingTrend: boolean;
  weeklyTrend: any[];
  overview: any;
  insights: any;
}
export default function TrendsTab({
  isLoadingTrend,
  weeklyTrend,
  overview,
  insights,
}: TrendsTabProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;
  const targetCurrency = (settings?.currency || "EUR") as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, targetCurrency, false).formatted;

  return (
    <div className="space-y-6">
      {isLoadingTrend && <Loader />}
      {weeklyTrend && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartContainer title={t("reports.monthlyTrends")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview?.monthly || []}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis domain={[0, "dataMax"]} {...chartAxisProps} />
                <Tooltip
                  {...chartLineTooltipProps}
                  formatter={(value) => [formatCurrency(Number(value)), ""]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name={t("reports.totalExpenses")}
                  stroke="#f43f5e"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title={t("reports.weeklyPattern")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="day" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(value) => [formatCurrency(Number(value)), ""]}
                />
                <Bar
                  dataKey="amount"
                  name={t("reports.spendingLabel")}
                  fill="#2dd4bf"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
      {insights && insights.projectedExpenses !== undefined && (
        <div className="glass-panel hover-glow rounded-xl p-6">
          <h3 className="mb-4 text-lg font-medium">
            {t("reports.trendAnalysis")}
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <InsightBox
              title={t("reports.projectedNextMonth")}
              value={formatCurrency(insights.projectedExpenses)}
              description={`${insights.projectedGrowth}% ${t(
                "reports.expectedChange",
              )}`}
            />
            <InsightBox
              title={t("reports.ytdComparison")}
              value={`${insights.ytdComparison}%`}
              description={t("reports.yearOverYearChange")}
            />
            <InsightBox
              title={t("reports.savingsTrend")}
              value={`${insights.savingsTrend}%`}
              description={t("reports.monthlySavingsGrowthRate")}
            />
          </div>
        </div>
      )}

      {insights?.seasonalPatterns?.length > 0 && (
        <div className="glass-panel hover-glow rounded-xl p-6">
          <h3 className="mb-4 text-lg font-medium">
            {t("reports.historicalPatterns")}
          </h3>
          <div className="space-y-4">
            {insights.seasonalPatterns.map((pattern: any) => (
              <InsightBox
                key={pattern.period}
                title={pattern.period}
                value={formatCurrency(pattern.averageSpending)}
                description={`${t("reports.typical")} ${pattern.description}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
