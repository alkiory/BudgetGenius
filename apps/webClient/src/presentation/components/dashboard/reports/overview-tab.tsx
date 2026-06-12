/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { TrendingUp, ArrowDownUp, PieChartIcon, BarChart3 } from "lucide-react";
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Pie, Cell, BarChart, PieChart } from "recharts";
import { ChartContainer } from "./inner-componets";
import SummaryCard from "./summary-card";
import Loader from "@presentation/components/loader";

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
  insights
}: OverviewTabProps) {
  const { t } = useTranslation();
  const formatCurrency = (value: number) =>
    `$${value?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {isLoadingOverview && <Loader />}
      <div className="grid gap-6 md:grid-cols-4">
        <SummaryCard
          title={t('reports.totalIncome')}
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          color="green"
          subtitle={timeframeText[timeframe]}
        />

        <SummaryCard
          title={t('reports.totalExpenses')}
          value={formatCurrency(totalExpenses)}
          icon={ArrowDownUp}
          color="red"
          subtitle={timeframeText[timeframe]}
        />

        <SummaryCard
          title={t('reports.savings')}
          value={formatCurrency(savingsAmount)}
          icon={PieChartIcon}
          color="blue"
          subtitle={`${savingsRate}% ${t('reports.ofIncomeSaved')}`}
        />

        <SummaryCard
          title={t('reports.topSpending')}
          value={topCategory?.category || t('reports.nA')}
          icon={BarChart3}
          color="purple"
          subtitle={topCategory ? formatCurrency(topCategory.amount) + ' ' + t('reports.spent') : ''}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartContainer title={t('reports.incomeExpensesTab')}>
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

        <ChartContainer title={t('reports.spendingByCategory')}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories || []}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ category, percent }) =>
                  `${category} ${(percent * 100).toFixed(0)}%`}
              >
                {categories?.map((entry: { amount: number; category: string; color?: string }, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || '#8b5cf6'}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Insights */}
      {isLoadingInsights && <Loader />}
      {insights && (
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-medium">{t('reports.financialInsights')}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h4 className="font-medium">{t('reports.highestSpendingMonthLabel')}</h4>
              <p className="mt-1 text-2xl font-bold">{highestSpendingMonth?.month}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(highestSpendingMonth?.expenses)} {t('reports.spent')}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h4 className="font-medium">{t('reports.averageMonthlyExpenses')}</h4>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(insights.data.averageAmountExpenses)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('reports.perMonth')}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h4 className="font-medium">{t('reports.expenseToIncomeRatio')}</h4>
              <p className="mt-1 text-2xl font-bold">
                {Math.round(insights.data.expenseToIncomeRatio)}%
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('reports.lowerIsBetter')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}