import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, Pie, Cell, Tooltip, Legend, PieChart } from "recharts";
import { ChartContainer, ProgressBar, InsightBox } from "./inner-componets";
import Loader from "@presentation/components/loader";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TrendsTabProps {
  isLoadingInsights: boolean
  weeklyTrend: any[]
  totalExpenses: any
  insights: any
  categories: any
}

export default function CategoryTab({ isLoadingInsights, categories, insights, totalExpenses }: TrendsTabProps) {
  const { t } = useTranslation();
  const formatCurrency = (value: number) =>
    `$${value?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return (
    <div className="space-y-6">
      {isLoadingInsights && <Loader />}
      {categories && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChartContainer title={t('reports.spendingByCategory')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`}
                >
                  {categories?.map((entry: any, index: string) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#8b5cf6'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-medium">{t('reports.categoryBreakdown')}</h3>
            <div className="space-y-4">
              {categories?.map((category: any) => (
                <div key={category.category}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color || '#8b5cf6' }}
                      />
                      <span className="font-medium">{category.category}</span>
                    </div>
                    <span>{formatCurrency(category.amount)}</span>
                  </div>
                  <ProgressBar
                    value={(category.amount / totalExpenses) * 100}
                    color={category.color || '#8b5cf6'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-medium">{t('reports.categoryInsights')}</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <InsightBox
                title={t('reports.topCategory')}
                value={insights.topCategory?.name}
                description={`${formatCurrency(insights.topCategory?.amount)} ${t('reports.spent')}`}
              />
              <InsightBox
                title={t('reports.fastestGrowing')}
                value={insights.fastestGrowingCategory?.name}
                description={`+${insights.fastestGrowingCategory?.growth}% ${t('reports.fromLastPeriod')}`}
              />
              <InsightBox
                title={t('reports.mostImproved')}
                value={insights.mostImprovedCategory?.name}
                description={`-${insights.mostImprovedCategory?.reduction}% ${t('reports.reduction')}`}
              />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
            <h3 className="mb-4 text-lg font-medium">{t('reports.recommendations')}</h3>
            <div className="space-y-4">
              {insights.recommendations?.map((rec: any) => (
                <div
                  key={rec.category}
                  className={`rounded-lg border p-4 ${rec.priority === 'high' ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10' :
                    rec.priority === 'medium' ? 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10' :
                      'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10'
                    }`}
                >
                  <h4 className="font-medium">{rec.category}</h4>
                  <p className="mt-1 text-sm">{rec.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}