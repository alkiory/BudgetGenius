import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Search, ArrowUpRight, Wallet, DollarSign } from "lucide-react";
import { useFetchIncomes } from "@adapters/query/dashboard";
import { Button } from "@presentation/components/ui/button";
import { IncomeModal } from "@presentation/components/dashboard/incomes/income-modal";
import { IncomeSourcesTable } from "@presentation/components/dashboard/incomes/income-source-table";
import { IncomeByCategory } from "@presentation/components/dashboard/incomes/income-by-category";
import { IncomeHistory } from "@presentation/components/dashboard/incomes/income-history";
import { IncomeCategory, IncomeRecurrence } from "@domain/dashboard/incomes/income.entity";
import Loader from "@presentation/components/loader";
import { FilterCriteria, FilterModal } from "@presentation/components/dashboard/incomes/filter-income-modal";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useSelector } from "react-redux";

export default function IncomePage() {
  const { t } = useTranslation();
  const [offset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useFetchIncomes(offset, limit);
  const incomes = useMemo(() => data?.incomes || [], [data]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [filters, setFilters] = useState<Omit<FilterCriteria, "statuses">>({
    dateFrom: "",
    dateTo: "",
    categories: ["All"],
    minAmount: 0,
    maxAmount: 0,
    recurrences: ["All"],
  });


  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  // Normalizar y filtrar ingresos inicialmente (sin aplicar filtros de recurrence aquí)
  const normalizedIncomes = useMemo(() => {
    return incomes
      .map((income) => ({
        ...income,
        amount: Number(income.amount) || 0,
      }))
      .filter((income) => income.amount > 0);
  }, [incomes]);

  // Filtrar transacciones
  const filteredIncomeTransactions = useMemo(() => {
    return normalizedIncomes.filter((income) => {
      const searchMatch =
        !searchTerm ||
        income.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        income.category.toLowerCase().includes(searchTerm.toLowerCase());

      const dateMatch =
        (!filters.dateFrom || new Date(income.date) >= new Date(filters.dateFrom)) &&
        (!filters.dateTo || new Date(income.date) <= new Date(filters.dateTo));

      const categoryMatch = filters.categories.includes("All") || filters.categories.includes(income.category as typeof filters.categories[number]);

      const minAmount = Number(filters.minAmount) || Number.NEGATIVE_INFINITY;
      const maxAmount = Number(filters.maxAmount) || Number.POSITIVE_INFINITY;
      const amountMatch = income.amount >= minAmount && income.amount <= maxAmount;

      // Recurrence filter
      const recurrenceMatch =
        filters.recurrences.includes("All") || filters.recurrences.includes(income.recurrence as IncomeRecurrence);

      return searchMatch && dateMatch && categoryMatch && amountMatch && recurrenceMatch;
    });
  }, [normalizedIncomes, searchTerm, filters]);

  // Calcular total
  const totalIncome = useMemo(() => {
    return filteredIncomeTransactions.reduce((sum, income) => sum + income.amount, 0).toFixed(2);
  }, [filteredIncomeTransactions]);

  // Calcular por categoría
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

  // Handle filter changes
  const handleApplyFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
  };

  // Active filters count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (!filters.categories.includes("All") && filters.categories.length > 0) count++;
    if (!filters.recurrences.includes("All") && filters.recurrences.length > 0) count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    return count;
  }, [filters]);

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedIncome = currencyService.formatCurrency(
    Number(totalIncome),
    'USD' as Currency,
    targetCurrency,
    false
  );

  const totalIncomeToDisplay = currencyService.formatCurrency(Number(totalIncome) / filteredIncomeTransactions.length, targetCurrency, targetCurrency, false).formatted

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        {/* Total Income Card */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">{t('income.totalIncome')}</span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">{formattedIncome.formatted}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('income.fromIncomes', { count: incomes.length })}</p>
        </div>

        {/* Primary Income Card */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">{t('income.primaryIncome')}</span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">
            {incomeByCategory.length > 0 ?
              `${currencyService.formatCurrency(incomeByCategory[0].amount, targetCurrency, targetCurrency, false).formatted}
              ` : "$0.00"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {incomeByCategory.length > 0 ? incomeByCategory.sort((a, b) => b.amount - a.amount)[0]?.category || "None" : "No income sources"}
          </p>
        </div>

        {/* Average Income Card */}
        <div className="w-full rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
              <ArrowUpRight className="h-4 w-4 text-purple-600 dark:text-purple-400 sm:h-5 sm:w-5" />
            </div>
            <span className="text-xs font-medium sm:text-sm">{t('income.averageIncome')}</span>
          </div>
          <p className="mt-2 text-xl font-bold sm:text-2xl">
            {totalIncome ?
              `${totalIncomeToDisplay !== "NaN" ? "$0.00" : totalIncomeToDisplay}`
              : "$0.00"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('income.perIncome')}</p>
        </div>
      </div>

      {/* Income Analytics - Responsive Grid */}
      <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 ">
        <IncomeByCategory incomeByCategory={incomeByCategory} />
        <IncomeHistory incomeTransactions={filteredIncomeTransactions} />
      </div>

      {/* Income Sources Table Section */}
      <div className=" px-2 md:px-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input - Responsive */}
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400 sm:h-5 sm:w-5" />
            </div>
            <input
              type="text"
              placeholder={t('income.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-400 sm:pl-10 sm:text-base"
            />
          </div>

          {/* Action Buttons - Responsive Stack */}
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              onClick={() => setIsFilterModalOpen(true)}
              variant="outline"
              className="inline-flex h-9 items-center gap-1 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
              <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{t('income.filter')}</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200 sm:px-2">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsIncomeModalOpen(true)}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{t('income.addIncome')}</span>
            </Button>
          </div>
        </div>

        {/* Income Sources Table - Responsive */}
        {filteredIncomeTransactions.length > 0 ? (
          <IncomeSourcesTable
            incomeTransactions={filteredIncomeTransactions.map((income) => ({
              ...income,
              category: income.category as IncomeCategory,
              recurrence: income.recurrence as IncomeRecurrence,
            }))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700 sm:gap-4 sm:p-8">
            <p className="text-sm text-slate-500 dark:text-slate-400 sm:text-base">{t('income.noSourcesFound')}</p>
            {searchTerm || activeFiltersCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
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
                {t('common.clearFilters')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsIncomeModalOpen(true)}>
                {t('income.addIncomeSource')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <div className=" ">
        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          onApplyFilters={handleApplyFilters}
          currentFilters={filters}
        />

        <IncomeModal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} />
      </div>
    </div>
  );
}