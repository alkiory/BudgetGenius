import { HttpReportRepository } from "@adapters/http/reports.repository";
import {
  useOverview,
  useCategoryBreakdown,
  useWeeklyTrend,
} from "@adapters/query/reports/reportsQuery";
import type {
  ExportFormat,
  ExportLocale,
} from "@domain/dashboard/reports/reports.repository";
import CategoryTab from "@presentation/components/dashboard/reports/categories-tab";
import IncomeExpensesTab from "@presentation/components/dashboard/reports/income-expenses-tab";
import OverviewTab from "@presentation/components/dashboard/reports/overview-tab";
import ReportsLoading from "@presentation/components/dashboard/reports/reports-loading";
import TrendsTab from "@presentation/components/dashboard/reports/trends-tab";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@presentation/components/ui/dropdown-menu";
import { BrandDots } from "@presentation/components/loader";
import { PageHeader } from "@presentation/components/ui/page-header";
import { Select } from "@presentation/components/ui/select";
import { downloadBlob } from "@infrastructure/downloadService";
import {
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
} from "@presentation/components/ui/animated-icons";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const FILENAME_BY_FORMAT: Record<ExportFormat, string> = {
  pdf: "budget-report-{year}.pdf",
  excel: "budget-report-{year}.xlsx",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateRange(timeframe: string, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (timeframe === "quarter") start.setMonth(Math.floor(today.getMonth() / 3) * 3, 1);
  if (timeframe === "year") start.setMonth(0, 1);
  if (timeframe === "all") start.setFullYear(1900, 0, 1);
  const endExclusive = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return { start: dateKey(start), end: dateKey(endExclusive) };
}

function countMonthsInclusive(start: string, end: string) {
  const from = new Date(`${start}T00:00:00`);
  const until = new Date(`${end}T00:00:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime())) return 0;
  return Math.max(0, (until.getFullYear() - from.getFullYear()) * 12 + until.getMonth() - from.getMonth() + (until.getDate() > 1 ? 1 : 0));
}

export default function ReportsPage() {
  // `i18n` is exposed by react-i18next so we can pass the active UI locale
  // to the export endpoint and let the server localize month labels in
  // PDF / Excel accordingly.
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeframe, setTimeframe] = useState("year");
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const currentYear = new Date().getFullYear();
  const dateRange = getDateRange(timeframe);

  // Consultas de datos
  const { data: overviewMonthly, isLoading: isLoadingOverview } = useOverview({
    ...dateRange,
  });
  const { data: categoryRows, isLoading: isLoadingCategories } =
    useCategoryBreakdown({
      ...dateRange,
    });
  const { data: weeklyTrend, isLoading: isLoadingTrend } = useWeeklyTrend(dateRange);

  if (isLoadingOverview || isLoadingCategories) {
    return <ReportsLoading />;
  }

  // The tabs expect envelope shapes ({monthly, ...}). The backend returns
  // raw arrays, so wrap them here and remap fields. This is the only place
  // in the app that consumes /reports/* responses.
  const rawMonthly = Array.isArray(overviewMonthly) ? overviewMonthly : [];
  const safeMonthly = rawMonthly.map(
    (row: { month: string; monthKey?: string; income: number | string; expenses: number | string }) => ({
      month: row.month,
      monthKey: row.monthKey,
      income: Number(row.income) || 0,
      expenses: Number(row.expenses) || 0,
    }),
  );
  const incomeSources = Array.isArray(categoryRows?.incomeSources)
    ? categoryRows.incomeSources
    : [];
  const overview = { monthly: safeMonthly, incomeSources };
  const savings = { monthly: safeMonthly.map((row) => ({ month: row.month, savings: row.income - row.expenses })) };
  const categories = (categoryRows?.expenses ?? []).map(
    (row: { category: string; total: number | string }) => ({
      category: row.category,
      name: row.category,
      amount: Number(row.total) || 0,
    }),
  );

  // Datos procesados
  const totalIncome = safeMonthly.reduce(
    (acc, row) => acc + row.income,
    0,
  );
  const totalExpenses = safeMonthly.reduce(
    (acc, row) => acc + row.expenses,
    0,
  );
  const savingsAmount = totalIncome - totalExpenses;
  let monthsElapsed = countMonthsInclusive(dateRange.start, dateRange.end);
  if (timeframe === "all" && safeMonthly.length) {
    const keys = safeMonthly.map((row) => row.monthKey).filter((key): key is string => Boolean(key)).sort();
    if (keys.length) monthsElapsed = countMonthsInclusive(`${keys[0]}-01`, `${keys[keys.length - 1]}-15`);
  }
  const insights = {
    data: {
      spent: totalExpenses,
      averageAmountExpenses: monthsElapsed ? totalExpenses / monthsElapsed : 0,
      expenseToIncomeRatio: totalIncome ? (totalExpenses / totalIncome) * 100 : 0,
    },
  };
  const isLoadingInsights = false;
  const savingsRate =
    totalIncome > 0
      ? Math.round((savingsAmount / totalIncome) * 100)
      : 0;

  const topCategory =
    categories.length > 0
      ? [...categories].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]
      : undefined;
  const highestSpendingMonth =
    safeMonthly.length > 0
      ? [...safeMonthly].sort(
            (a, b) => b.expenses - a.expenses,
      )[0]
      : undefined;

  const timeframeText: Record<string, string> = {
    month: t("reports.thisMonth"),
    quarter: t("reports.thisQuarter"),
    year: t("reports.thisYear"),
    all: t("reports.allTime"),
  };

  const handleExport = async (format: ExportFormat) => {
    if (isExporting) return;
    setIsExporting(format);
    try {
      // Forward the active UI locale (e.g. "es-CO") so the server can
      // translate the English month labels coming from Postgres
      // `to_char`. Anything outside the supported set falls back to
      // English server-side, so this stays permissive.
      const locale = i18n.language as ExportLocale | undefined;
      const blob = await HttpReportRepository.exportReport({
        format,
        year: String(currentYear),
        locale,
      });
      const filename = FILENAME_BY_FORMAT[format].replace(
        "{year}",
        String(currentYear),
      );

      const result = await downloadBlob(blob, filename, {
        dialogTitle: t("reports.exportNativeDialogTitle"),
        dialogSubtitle: t("reports.exportNativeDialogSubtitle"),
      });
      toast.success(
        result.uri
          ? t("reports.exportSavedNative")
          : t("reports.exportSuccess"),
      );
    } catch (err) {
      console.error("Report export failed:", err);
      toast.error(t("reports.exportError"));
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      >
        <div className="flex gap-2">
          {/* Selector de timeframe */}
          <Select
            value={timeframe}
            onChange={setTimeframe}
            aria-label={timeframeText[timeframe]}
            icon={<Calendar className="h-4 w-4" />}
            className="w-40"
            options={Object.entries(timeframeText).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isExporting !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 backdrop-blur transition hover:border-teal-400/40 hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-teal-400/10"
            >
              {isExporting ? (
                <BrandDots size="sm" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("reports.export")}
              <ChevronDown
                className="ml-1 h-3 w-3 opacity-70"
                aria-hidden="true"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-48">
              <DropdownMenuItem
                onClick={() => handleExport("pdf")}
                disabled={isExporting !== null}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4 text-rose-500" />
                <span>{t("reports.exportPdf")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("excel")}
                disabled={isExporting !== null}
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>{t("reports.exportExcel")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="border-b border-slate-200/80 dark:border-white/[0.07]">
        <nav className="no-scrollbar -mb-px flex space-x-6 overflow-x-auto">
          {["overview", "income-expenses", "categories", "trends"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 py-4 text-sm font-medium border-b-2 capitalize ${activeTab === tab
                  ? "border-teal-400 text-teal-600 dark:text-teal-300"
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
