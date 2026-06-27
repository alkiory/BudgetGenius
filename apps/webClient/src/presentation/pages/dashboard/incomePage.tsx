import { useFetchTransactions } from "@adapters/query/dashboard";
import { RootState } from "@adapters/store/rootStore";
import { AddTransactionModal } from "@presentation/components/dashboard/transaction/add-transaction-modal";
import {
  FilterCriteria,
  FilterModal,
} from "@presentation/components/dashboard/transaction/filter-transaction-modal";
import { Button } from "@presentation/components/ui/button";
import { PageHeader } from "@presentation/components/ui/page-header";
import Table from "@presentation/components/ui/table";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { translateCategory } from "@presentation/utils/display-translations";
import { Plus, Filter, ArrowUpRight, Wallet, DollarSign } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function IncomePage() {
  const { t } = useTranslation();
  const [offset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useFetchTransactions(offset, limit, "income");
  const incomes = useMemo(() => data?.transactions ?? [], [data]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    dateFrom: "",
    dateTo: "",
    categories: ["All"],
    minAmount: 0,
    maxAmount: 0,
    recurrences: ["All"],
  });

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const normalizedIncomes = useMemo(() => {
    return incomes
      .map((income) => ({
        ...income,
        amount: Number(income.amount) || 0,
      }))
      .filter((income) => income.amount > 0);
  }, [incomes]);

  const filteredIncomeTransactions = useMemo(() => {
    return normalizedIncomes.filter((income) => {
      const dateMatch =
        (!filters.dateFrom ||
          new Date(income.date) >= new Date(filters.dateFrom)) &&
        (!filters.dateTo || new Date(income.date) <= new Date(filters.dateTo));

      const categoryMatch =
        filters.categories.includes("All") ||
        filters.categories.includes(
          income.category as (typeof filters.categories)[number],
        );

      const minAmount = Number(filters.minAmount) || Number.NEGATIVE_INFINITY;
      const maxAmount = Number(filters.maxAmount) || Number.POSITIVE_INFINITY;
      const amountMatch =
        income.amount >= minAmount && income.amount <= maxAmount;

      const recurrenceMatch =
        !filters.recurrences ||
        filters.recurrences.length === 0 ||
        filters.recurrences.includes("All") ||
        (filters.recurrences as readonly string[]).includes(income.recurrence ?? "");

      return dateMatch && categoryMatch && amountMatch && recurrenceMatch;
    });
  }, [normalizedIncomes, filters]);

  const totalIncome = useMemo(() => {
    return filteredIncomeTransactions
      .reduce((sum, income) => sum + income.amount, 0)
      .toFixed(2);
  }, [filteredIncomeTransactions]);

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();

    filteredIncomeTransactions.forEach((income) => {
      const currentAmount = categoryMap.get(income.category) || 0;
      categoryMap.set(income.category, currentAmount + income.amount);
    });

    return Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }));
  }, [filteredIncomeTransactions]);

  const handleApplyFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (!filters.categories.includes("All") && filters.categories.length > 0)
      count++;
    if (
      filters.recurrences &&
      !filters.recurrences.includes("All") &&
      filters.recurrences.length > 0
    )
      count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    return count;
  }, [filters]);

  const targetCurrency = (settings?.currency || "USD") as Currency;
  const formattedIncome = currencyService.formatCurrency(
    Number(totalIncome),
    "USD" as Currency,
    targetCurrency,
    false,
  );

  const averageIncome =
    filteredIncomeTransactions.length > 0
      ? Number(totalIncome) / filteredIncomeTransactions.length
      : null;
  const averageIncomeIsFinite =
    averageIncome !== null && Number.isFinite(averageIncome);
  const totalIncomeToDisplay = averageIncomeIsFinite
    ? currencyService.formatCurrency(
      averageIncome,
      "USD" as Currency,
      targetCurrency,
      false,
    ).formatted
    : t("common.noData");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500 dark:text-slate-400">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("transactions.heading.income")}
        description={t("transactions.heading.incomeDescription")}
      />

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        {/* Total Income Card */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">
              {t("transactions.heading.totalIncome")}
            </span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">
            {formattedIncome.formatted}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("transactions.heading.fromIncomeCount", {
              count: normalizedIncomes.length,
            })}
          </p>
        </div>

        {/* Primary Income Card (Top Category) */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">
              {t("transactions.heading.primaryCategory")}
            </span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">
            {incomeByCategory.length > 0
              ? `${currencyService.formatCurrency(
                incomeByCategory[0].amount,
                "USD" as Currency,
                targetCurrency,
                false,
              ).formatted
              }
              `
              : t("common.noData")}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {incomeByCategory.length > 0
              ? translateCategory(
                incomeByCategory.sort((a, b) => b.amount - a.amount)[0]
                  ?.category || "",
                t,
              )
              : t("transactions.heading.noIncomeSources")}
          </p>
        </div>

        {/* Average Income Card — NaN-safe (Phase 3 T3.7) */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
              <ArrowUpRight className="h-4 w-4 text-purple-600 dark:text-purple-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">
              {t("transactions.heading.averageIncome")}
            </span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">
            {totalIncomeToDisplay}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("transactions.heading.averageIncomeHint")}
          </p>
        </div>
      </div>

      {/* Income Sources Table Section */}
      <div className="px-2 md:px-0">
        <div className="mb-4 flex items-center justify-end">
          <div className="flex gap-2">
            <Button
              onClick={() => setIsFilterModalOpen(true)}
              variant="outline"
              className="inline-flex h-9 items-center gap-1 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
              <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{t("common.filter")}</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200 sm:px-2">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <AddTransactionModal
              trigger={
                <Button
                  variant="primary"
                  className="inline-flex h-9 items-center gap-1 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{t("transactions.addTransaction")}</span>
                </Button>
              }
            />
          </div>
        </div>

        {/* Income Sources Table — shared Table component */}
        {filteredIncomeTransactions.length > 0 ? (
          <Table data={filteredIncomeTransactions} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700 sm:gap-4 sm:p-8">
            <p className="text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              {t("transactions.heading.noIncomeSources")}
            </p>
            {activeFiltersCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({
                    dateFrom: "",
                    dateTo: "",
                    categories: ["All"],
                    minAmount: 0,
                    maxAmount: 0,
                    recurrences: ["All"],
                  });
                }}
              >
                {t("common.clearFilters")}
              </Button>
            ) : (
              <AddTransactionModal
                trigger={
                  <Button size="sm">{t("transactions.addTransaction")}</Button>
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  );
}
