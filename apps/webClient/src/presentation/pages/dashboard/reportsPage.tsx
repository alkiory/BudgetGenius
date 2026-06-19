import { HttpReportRepository } from "@adapters/http/reports.repository";
import {
  useOverview,
  useCategoryBreakdown,
  useWeeklyTrend,
  useSavingsGrowth,
  useInsights,
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
import { PageHeader } from "@presentation/components/ui/page-header";
import { downloadBlob } from "@presentation/utils/downloadBlob";
import {
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const FILENAME_BY_FORMAT: Record<ExportFormat, string> = {
  pdf: "budget-report-{year}.pdf",
  excel: "budget-report-{year}.xlsx",
};

export default function ReportsPage() {
  // `i18n` is exposed by react-i18next so we can pass the active UI locale
  // to the export endpoint and let the server localize month labels in
  // PDF / Excel accordingly.
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeframe, setTimeframe] = useState("year");
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const currentYear = new Date().getFullYear();

  // Consultas de datos
  const { data: overviewMonthly, isLoading: isLoadingOverview } = useOverview({
    year: String(currentYear),
  });
  const { data: categoryRows, isLoading: isLoadingCategories } =
    useCategoryBreakdown({
      start: `${currentYear}-01-01`,
      end: `${currentYear}-12-31`,
    });
  const { data: weeklyTrend, isLoading: isLoadingTrend } = useWeeklyTrend();
  const { data: savingsMonthly, isLoading: isLoadingSavings } =
    useSavingsGrowth({ year: String(currentYear) });
  const { data: insights, isLoading: isLoadingInsights } = useInsights({
    year: String(currentYear),
  });

  if (isLoadingOverview || isLoadingCategories || isLoadingSavings) {
    return <ReportsLoading />;
  }

  // The tabs expect envelope shapes ({monthly, ...}). The backend returns
  // raw arrays, so wrap them here and remap fields. This is the only place
  // in the app that consumes /reports/* responses.
  const overview = { monthly: overviewMonthly ?? [] };
  const savings = { monthly: savingsMonthly ?? [] };
  const categories = (categoryRows ?? []).map(
    (row: { category: string; total: number | string }) => ({
      category: row.category,
      amount: Number(row.total) || 0,
    }),
  );

  // Datos procesados
  const safeMonthly: {
    month: string;
    income: number | string;
    expenses: number | string;
  }[] = Array.isArray(overview.monthly)
      ? (overview.monthly as {
        month: string;
        income: number | string;
        expenses: number | string;
      }[])
      : [];
  const totalIncome = safeMonthly.reduce(
    (acc, row) => acc + (Number(row?.income) || 0),
    0,
  );
  const totalExpenses = safeMonthly.reduce(
    (acc, row) => acc + (Number(row?.expenses) || 0),
    0,
  );
  const savingsAmount = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0
      ? Math.max(0, Math.round((savingsAmount / totalIncome) * 100))
      : 0;

  const topCategory =
    categories.length > 0
      ? [...categories].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]
      : undefined;
  const highestSpendingMonth =
    safeMonthly.length > 0
      ? [...safeMonthly].sort(
        (a, b) => (Number(b?.expenses) || 0) - (Number(a?.expenses) || 0),
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
      downloadBlob(blob, filename);
      toast.success(t("reports.exportSuccess"));
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

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isExporting !== null}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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
                <FileText className="h-4 w-4 text-red-500" />
                <span>{t("reports.exportPdf")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("excel")}
                disabled={isExporting !== null}
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>{t("reports.exportExcel")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                className={`py-4 text-sm font-medium border-b-2 capitalize ${activeTab === tab
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
