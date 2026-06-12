/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Bar, LineChart, BarChart } from "recharts";
import { ChartContainer, InsightBox } from "./inner-componets";
import Loader from "@presentation/components/loader";

interface TrendsTabProps {
  isLoadingTrend: boolean;
  weeklyTrend: any[];
  overview: any;
  insights: any;
}
export default function TrendsTab({ isLoadingTrend, weeklyTrend, overview, insights }: TrendsTabProps) {
  const { t } = useTranslation();
  const formatCurrency = (value: number) =>
    `$${value?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {isLoadingTrend && <Loader />}
      {weeklyTrend && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartContainer title={t('reports.monthlyTrends')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview?.monthly || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name={t('reports.totalExpenses')}
                  stroke="#ef4444"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title={t('reports.weeklyPattern')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                <Bar dataKey="amount" name={t('reports.spendingLabel')} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
      {insights && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-medium">{t('reports.trendAnalysis')}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <InsightBox
              title={t('reports.projectedNextMonth')}
              value={formatCurrency(insights.projectedExpenses)}
              description={`${insights.projectedGrowth}% ${t('reports.expectedChange')}`}
            />
            <InsightBox
              title={t('reports.ytdComparison')}
              value={`${insights.ytdComparison}%`}
              description={t('reports.yearOverYearChange')}
            />
            <InsightBox
              title={t('reports.savingsTrend')}
              value={`${insights.savingsTrend}%`}
              description={t('reports.monthlySavingsGrowthRate')}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
        <h3 className="mb-4 text-lg font-medium">{t('reports.historicalPatterns')}</h3>
        <div className="space-y-4">
          {insights?.seasonalPatterns?.map((pattern: any) => (
            <InsightBox
              key={pattern.period}
              title={pattern.period}
              value={formatCurrency(pattern.averageSpending)}
              description={`${t('reports.typical')} ${pattern.description}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}