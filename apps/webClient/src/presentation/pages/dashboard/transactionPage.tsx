import { useTranslation } from 'react-i18next';
import { Filter, Plus } from "lucide-react";
import Table from "../../components/ui/table";
import { useFetchTransactions } from "@adapters/query/dashboard";
import { AddTransactionModal } from "@presentation/components/dashboard/transaction/add-transaction-modal";
import { useMemo, useState } from "react";
import {
  FilterCriteria,
  FilterModal,
} from "@presentation/components/dashboard/transaction/filter-transaction-modal";
import { Button } from "@presentation/components/ui/button";
import { PageHeader } from "@presentation/components/ui/page-header";
import { warningToast } from "@presentation/utils/toast";
import TransactionsLoading from "@presentation/components/dashboard/transactions/transactions-loading";

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [offset] = useState(0);
  const limit = 50;

  const { data: transactions, isSuccess, isLoading } = useFetchTransactions(offset, limit);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    dateFrom: "",
    dateTo: "",
    categories: ["All"],
    minAmount: 0,
    maxAmount: 0,
    statuses: ["All"],
  });

  const handleApplyFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) {
      return [];
    }

    return transactions.transactions?.filter((transaction) => {
      const dateMatch =
        (!filters.dateFrom || new Date(transaction.date) >= new Date(filters.dateFrom)) &&
        (!filters.dateTo || new Date(transaction.date) <= new Date(filters.dateTo));

      const categoryMatch =
        filters.categories.includes("All") || filters.categories.includes(transaction.category as typeof filters.categories[number]);

      const minAmount = filters.minAmount || Number.NEGATIVE_INFINITY;
      const maxAmount = filters.maxAmount || Number.POSITIVE_INFINITY;
      const amountMatch = transaction.amount >= minAmount && transaction.amount <= maxAmount;

      const statusMatch =
        filters.statuses?.includes("All") || filters.statuses?.includes(transaction.status || "");

      return dateMatch && categoryMatch && amountMatch && statusMatch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions?.transactions, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (!filters.categories.includes("All") && filters.categories?.length > 0) count++;
    if ((filters.minAmount ?? 0) > 0) count++;
    if ((filters.maxAmount ?? 0) > 0) count++;
    if (filters.statuses && !filters.statuses.includes("All") && filters.statuses?.length > 0) count++;
    return count;
  }, [filters]);

  // Handle the case where no transactions are found after filtering
  useMemo(() => {
    if (isSuccess && filteredTransactions?.length === 0 && activeFiltersCount > 0) {
      warningToast("No transactions found matching your search criteria.", 3000, "no-transactions");
    }
  }, [isSuccess, filteredTransactions, activeFiltersCount]);

  if (isLoading) {
    return <TransactionsLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('transactions.title')} description={t('transactions.description')} />

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('transactions.title')}
          </span>
          <span className="text-xs text-slate-400">
            {isSuccess && filteredTransactions?.length > 0 && `(${filteredTransactions.length})`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Filter className="h-4 w-4" />
            {t('common.filter')}
            {activeFiltersCount > 0 && (
              <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <AddTransactionModal />
        </div>
      </div>

      {isSuccess && filteredTransactions?.length > 0 ? (
        <Table data={filteredTransactions} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border border-dashed rounded-lg border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">{t('transactions.noTransactions')}</p>
          {activeFiltersCount === 0 && <AddTransactionModal />}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  dateFrom: "",
                  dateTo: "",
                  categories: ["All"],
                  minAmount: 0,
                  maxAmount: 0,
                  statuses: ["All"],
                });
              }}
            >
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
      )}

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />

      {/* This is the pagination that will be implemented in the future */}
      {/* <div>
        <Button
          className="text-sm text-purple-600 hover:underline dark:text-purple-400"
          onClick={handlePreviousPage}
        >
          Previous
        </Button>
        <Button
          className="text-sm text-purple-600 hover:underline dark:text-purple-400"
          onClick={handleNextPage}
        >
          Next
        </Button>
      </div> */}
    </div>
  );
}