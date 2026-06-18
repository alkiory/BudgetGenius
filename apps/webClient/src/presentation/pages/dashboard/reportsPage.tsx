import {
  useOverview,
  useCategoryBreakdown,
  useWeeklyTrend,
  useSavingsGrowth,
  useInsights,
} from "@adapters/query/reports/reportsQuery";
import CategoryTab from "@presentation/components/dashboard/reports/categories-tab";
import IncomeExpensesTab from "@presentation/components/dashboard/reports/income-expenses-tab";
import OverviewTab from "@presentation/components/dashboard/reports/overview-tab";
import ReportsLoading from "@presentation/components/dashboard/reports/reports-loading";
import TrendsTab from "@presentation/components/dashboard/reports/trends-tab";
import { PageHeader } from "@presentation/components/ui/page-header";
import { Calendar, Download, Filter } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function ReportsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeframe, setTimeframe] = useState("year");
  const currentYear = new Date().getFullYear();

  // Consultas de datos
  const { data: overview, isLoading: isLoadingOverview } = useOverview({
    year: String(currentYear),
  });
  const { data: categories, isLoading: isLoadingCategories } =
    useCategoryBreakdown({
      start: `${currentYear}-01-01`,
      end: `${currentYear}-12-31`,
    });
  const { data: weeklyTrend, isLoading: isLoadingTrend } = useWeeklyTrend();
  const { data: savings } = useSavingsGrowth({ year: String(currentYear) });
  const { data: insights, isLoading: isLoadingInsights } = useInsights({
    year: String(currentYear),
  });

  if (isLoadingOverview || isLoadingCategories) {
    return <ReportsLoading />;
  }

  // Datos procesados
  const totalIncome = overview?.totalIncome || 0;
  const totalExpenses = overview?.totalExpenses || 0;
  const savingsAmount = totalIncome - totalExpenses;
  const savingsRate = Math.round((savingsAmount / totalIncome) * 100) || 0;

  const topCategory = [...(categories || [])].sort(
    (a, b) => b.amount - a.amount,
  )[0];
  const highestSpendingMonth = [...(overview?.monthly || [])].sort(
    (a, b) => b.expenses - a.expenses,
  )[0];

  const timeframeText: Record<string, string> = {
    month: t("reports.thisMonth"),
    quarter: t("reports.thisQuarter"),
    year: t("reports.thisYear"),
    all: t("reports.allTime"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      >
        <div className="flex gap-2">
          {/* Selector de timeframe */}
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {timeframeText &&
                Object.keys(timeframeText).map((key) => (
                  <option key={key} value={key}>
                    {timeframeText[key]}
                  </option>
                ))}
            </select>
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>

          <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <Filter className="h-4 w-4" />
            {t("reports.filter")}
          </button>

          <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <Download className="h-4 w-4" />
            {t("reports.export")}
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-6">
          {["overview", "income-expenses", "categories", "trends"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-medium border-b-2 capitalize ${
                  activeTab === tab
                    ? "border-purple-500 text-purple-600 dark:text-purple-400"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {tab === "overview"
                  ? t("reports.overviewTab")
                  : tab === "income-expenses"
                  ? t("reports.incomeExpensesTab")
                  : tab === "categories"
                  ? t("reports.categoriesTab")
                  : t("reports.trendsTab")}
              </button>
            ),
          )}
        </nav>
      </div>

      {/* Overview tabs */}
      {activeTab === "overview" && (
        <OverviewTab
          timeframe={timeframe}
          overview={overview}
          isLoadingOverview={isLoadingOverview}
          topCategory={topCategory}
          highestSpendingMonth={highestSpendingMonth}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          savingsRate={savingsRate}
          categories={categories}
          insights={insights}
          isLoadingInsights={isLoadingInsights}
          savingsAmount={savingsAmount}
          timeframeText={timeframeText}
        />
      )}

      {/* Income vs Expenses Tab */}
      {activeTab === "income-expenses" && (
        <IncomeExpensesTab
          isLoadingInsights={isLoadingInsights}
          overview={overview}
          insights={insights}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          savingsRate={savingsRate}
          savings={savings}
        />
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <CategoryTab
          insights={insights}
          weeklyTrend={weeklyTrend}
          categories={categories}
          isLoadingInsights={isLoadingInsights}
          totalExpenses={totalExpenses}
        />
      )}

      {/* Trends Tab */}
      {activeTab === "trends" && (
        <TrendsTab
          insights={insights}
          weeklyTrend={weeklyTrend}
          overview={overview}
          isLoadingTrend={isLoadingTrend}
        />
      )}
    </div>
  );
}
