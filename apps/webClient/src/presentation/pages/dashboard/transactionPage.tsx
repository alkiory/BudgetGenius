import { useFetchTransactions } from "@adapters/query/dashboard";
import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { HttpExpenseCategoryRepository } from "@adapters/http/expense-category.repository";
import { RootState } from "@adapters/store/rootStore";
import {
  readCategorySpreadsheet,
  readTransactionSpreadsheet,
} from "@infrastructure/transactionSpreadsheetImport";
import { useQueryClient } from "@tanstack/react-query";
import { AddTransactionModal } from "@presentation/components/dashboard/transaction/add-transaction-modal";
import {
  FilterCriteria,
  FilterModal,
} from "@presentation/components/dashboard/transaction/filter-transaction-modal";
import { BrandDots } from "@presentation/components/loader";
import TransactionsLoading from "@presentation/components/dashboard/transactions/transactions-loading";
import { Button } from "@presentation/components/ui/button";
import { PageHeader } from "@presentation/components/ui/page-header";
import { warningToast } from "@presentation/utils/toast";
import { FileUp, Filter } from "@presentation/components/ui/animated-icons";
import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Table from "../../components/ui/table";

export default function TransactionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useSelector(
    (state: RootState) => state.userSettings?.settings?.currency || "EUR",
  );
  const importInput = useRef<HTMLInputElement>(null);
  const categoryImportInput = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  // The API defaults to 50 rows. A spreadsheet import can contain up to
  // 1,000 transactions, so load that supported import size for the table's
  // own client-side pagination and filters.
  const offset = 0;
  const limit = 1000;

  const {
    data: transactions,
    isSuccess,
    isLoading,
  } = useFetchTransactions(offset, limit);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    dateFrom: "",
    dateTo: "",
    categories: ["All"],
    minAmount: 0,
    maxAmount: 0,
  });

  const handleApplyFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const rows = await readTransactionSpreadsheet(
        file,
        currency as "EUR" | "USD" | "COP",
      );
      let importedCategories: Awaited<ReturnType<typeof readCategorySpreadsheet>> = [];
      try {
        importedCategories = await readCategorySpreadsheet(file);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("No se encontró una tabla de categorías")) {
          throw error;
        }
      }
      const categoryMap = new Map(
        importedCategories.map((category) => [category.name.toLocaleLowerCase(), category]),
      );
      for (const row of rows) {
        const key = row.category.trim().toLocaleLowerCase();
        if (!categoryMap.has(key)) categoryMap.set(key, { name: row.category, value: 0 });
      }
      await HttpExpenseCategoryRepository.importMany([...categoryMap.values()]);
      const result = await HttpTransactionRepository.importTransactions(rows);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["user-expense-categories"] }),
      ]);
      toast.success(t("transactions.importSpreadsheetSuccess", { count: result.created }));
    } catch (error) {
      console.error("Transaction import failed:", error);
      const errorCode = error instanceof Error ? error.message : "";
      toast.error(
        errorCode === "CATEGORY_SUMMARY_NOT_TRANSACTION_ROWS"
          ? t("transactions.categorySummaryNotTransactionRows")
          : errorCode === "TRANSACTION_COLUMNS_NOT_FOUND"
            ? t("transactions.transactionColumnsNotFound")
            : errorCode || t("transactions.importSpreadsheetError"),
      );
    } finally {
      setIsImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  };

  const handleCategoryImport = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const imported = await readCategorySpreadsheet(file);
      const result = await HttpExpenseCategoryRepository.importMany(imported);
      await queryClient.invalidateQueries({ queryKey: ["user-expense-categories"] });
      toast.success(t("transactions.importCategoriesSuccess", result));
    } catch (error) {
      console.error("Category import failed:", error);
      toast.error(error instanceof Error ? error.message : t("transactions.importSpreadsheetError"));
    } finally {
      setIsImporting(false);
      if (categoryImportInput.current) categoryImportInput.current.value = "";
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) {
      return [];
    }

    return transactions.transactions?.filter((transaction) => {
      const dateMatch =
        (!filters.dateFrom ||
          new Date(transaction.date) >= new Date(filters.dateFrom)) &&
        (!filters.dateTo ||
          new Date(transaction.date) <= new Date(filters.dateTo));

      const categoryMatch =
        filters.categories.includes("All") ||
        filters.categories.includes(
          transaction.category as (typeof filters.categories)[number],
        );

      const minAmount = filters.minAmount || Number.NEGATIVE_INFINITY;
      const maxAmount = filters.maxAmount || Number.POSITIVE_INFINITY;
      const amountMatch =
        transaction.amount >= minAmount && transaction.amount <= maxAmount;

      return dateMatch && categoryMatch && amountMatch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions?.transactions, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (!filters.categories.includes("All") && filters.categories?.length > 0)
      count++;
    if ((filters.minAmount ?? 0) > 0) count++;
    if ((filters.maxAmount ?? 0) > 0) count++;
    return count;
  }, [filters]);

  // Handle the case where no transactions are found after filtering
  useMemo(() => {
    if (
      isSuccess &&
      filteredTransactions?.length === 0 &&
      activeFiltersCount > 0
    ) {
      warningToast(
        "No transactions found matching your search criteria.",
        3000,
        "no-transactions",
      );
    }
  }, [isSuccess, filteredTransactions, activeFiltersCount]);

  if (isLoading) {
    return <TransactionsLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("transactions.title")}
        description={t("transactions.description")}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("transactions.title")}
          </span>
          <span className="text-xs text-slate-400">
            {isSuccess &&
              filteredTransactions?.length > 0 &&
              `(${filteredTransactions.length})`}
          </span>
        </div>

        {/* Buttons row: stacks on mobile (flex-col + items-stretch so
            each button stretches to full row width), side-by-side on
            `sm:` and up (flex-row + items-center, buttons back to
            natural size). Together with the outer `flex-col sm:flex-row`
            above, the title row gets its own line on mobile instead
            of being squeezed to 0 width by the full-width buttons. */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <input
            ref={importInput}
            type="file"
            accept=".xlsx,.xlsm,.xls,.xlsb,.ods,.xml,.csv,.tsv"
            className="hidden"
            aria-label="Importar movimientos desde archivo"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            disabled={isImporting}
            onClick={() => importInput.current?.click()}
            className="w-full sm:w-auto"
          >
            {isImporting ? (
              <BrandDots size="sm" className="mr-2" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {isImporting
              ? t("transactions.importingSpreadsheet")
              : t("transactions.importSpreadsheet")}
          </Button>
          <input
            ref={categoryImportInput}
            type="file"
            accept=".xlsx,.xlsm,.xls,.xlsb,.ods,.xml,.csv,.tsv"
            className="hidden"
            aria-label={t("transactions.importCategories")}
            onChange={(event) => void handleCategoryImport(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            disabled={isImporting}
            onClick={() => categoryImportInput.current?.click()}
            className="w-full sm:w-auto"
          >
            <FileUp className="mr-2 h-4 w-4" />
            {t("transactions.importCategories")}
          </Button>
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="inline-flex w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
          >
            <Filter className="h-4 w-4" />
            {t("common.filter")}
            {activeFiltersCount > 0 && (
              <span className="ml-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-400/15 dark:text-teal-200">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {/* `triggerClassName` makes the default modal CTA respect
              the same `w-full sm:w-auto` breakpoint contract as the
              Filter button. Without it, the `+ Add Transaction`
              button would stay at its natural "lg" button width while
              the Filter button stretches — visually inconsistent on
              mobile where both should be touch-sized full-width
              rows. */}
          <AddTransactionModal triggerClassName="w-full sm:w-auto" />
        </div>
      </div>

      {isSuccess && filteredTransactions?.length > 0 ? (
        <Table data={filteredTransactions} initialPageSize={50} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border border-dashed rounded-lg border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">
            {t("transactions.noTransactions")}
          </p>
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
                });
              }}
            >
              {t("common.clearFilters")}
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
          className="text-sm text-teal-600 hover:underline dark:text-teal-400"
          onClick={handlePreviousPage}
        >
          Previous
        </Button>
        <Button
          className="text-sm text-teal-600 hover:underline dark:text-teal-400"
          onClick={handleNextPage}
        >
          Next
        </Button>
      </div> */}
    </div>
  );
}
