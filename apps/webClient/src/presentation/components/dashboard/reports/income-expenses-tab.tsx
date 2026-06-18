/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line, BarChart, LineChart } from "recharts";
import { ChartContainer, ProgressBar, InsightBox } from "./inner-componets";
import Loader from "@presentation/components/loader";
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";

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
  savings
}: IncomeExpensesTabProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;
  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formatCurrency = (value: number) =>
    currencyService.formatCurrency(value, 'USD' as Currency, targetCurrency, false).formatted;

  return (
    <div className="space-y-6">
      <ChartContainer title={t('reports.monthlyIncomeVsExpenses')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={overview?.monthly || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
            <Legend />
            <Bar dataKey="income" name={t('reports.totalIncome')} fill="#10b981" />
            <Bar dataKey="expenses" name={t('reports.totalExpenses')} fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Ratios */}
      {isLoadingInsights && <Loader />}
      {overview && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-medium">{t('reports.incomeBreakdown')}</h3>
            <div className="space-y-4">
              {overview?.incomeSources?.map((source: any) => (
                <div key={source.category}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{source.category}</span>
                    <span>{formatCurrency(source.amount)}</span>
                  </div>
                  <ProgressBar
                    value={(source.amount / totalIncome) * 100}
                    color="#10b981"
                  />
                </div>
              ))}
            </div>
          </div>

          <ChartContainer title={t('reports.savingsGrowth')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savings?.monthly || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), t('transactions.amount')]} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {insights && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-medium">{t('reports.financialRatios')}</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <InsightBox
              title={t('reports.incomeRatio')}
              value={`${Math.round((totalIncome / (totalIncome + totalExpenses) * 100))}%`}
              description={t('reports.percentageOfCashFlow')}
            />
            <InsightBox
              title={t('reports.expensesRatio')}
              value={`${Math.round((totalExpenses / (totalIncome + totalExpenses) * 100))}%`}
              description={t('reports.percentageOfCashFlow')}
            />
            <InsightBox
              title={t('reports.savingsRate')}
              value={`${savingsRate}%`}
              description={t('reports.ofIncomeSavedShort')}
            />
          </div>
        </div>
      )}
    </div>
  );
}