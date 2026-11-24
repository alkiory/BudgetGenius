import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { RootState } from "@adapters/store/rootStore";
import { Transaction } from "@domain/dashboard/transactions/transaction.entity";
import { validateTransactionSelection } from "@domain/dashboard/transactions/validateTransactionSelection";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { translateCategory } from "@presentation/utils/display-translations";
import {
  successToast,
  errorToast,
  warningToast,
} from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  createColumnHelper,
} from "@tanstack/react-table";
import { Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { EditTransaction } from "../dashboard/transaction/edit-transaction";
import { Button } from "./button";
import { Select } from "./select";

export default function Table({
  data,
  initialPageSize = 10,
}: {
  data: Transaction[];
  initialPageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [rowSelection, setRowSelection] = useState({});
  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const columnHelper = createColumnHelper<Transaction>();

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;
  const locale = settings?.locale || "en-US";

  const { mutate: deleteAllTransactions } = useMutation({
    mutationKey: ["delete-all-transactions"],
    mutationFn: HttpTransactionRepository.deleteAllTransactions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-delete");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-delete");
    },
  });

  const handleMultipleDelete = ({
    rowSelection,
  }: {
    rowSelection: number[];
  }) => {
    if (!validateTransactionSelection(rowSelection)) {
      warningToast("No transactions selected", 3000, "transaction-delete");
      return;
    }

    deleteAllTransactions(rowSelection);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
  };

  const { mutate: deleteTransaction } = useMutation({
    mutationKey: ["delete-transaction"],
    mutationFn: HttpTransactionRepository.deleteTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-delete");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-delete");
    },
  });

  const columns = [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <div className="px-1">
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-teal-500"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="px-1">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-teal-500"
          />
        </div>
      ),
    }),
    columnHelper.accessor("date", {
      header: () => t("transactions.date"),
      cell: (info) => {
        const value = info.getValue();
        const date =
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T00:00:00`)
            : new Date(value);
        return date.toLocaleDateString(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
    }),
    columnHelper.accessor("description", {
      header: () => t("transactions.description"),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("category", {
      header: () => t("transactions.category"),
      cell: (info) => translateCategory(info.getValue() as string, t),
    }),
    columnHelper.accessor("amount", {
      header: () => t("transactions.amount"),
      cell: (info) => {
        const transaction = info.row.original;
        const targetCurrency = (settings?.currency || "EUR") as Currency;
        const formatted = currencyService.formatCurrency(
          transaction.amount,
          targetCurrency,
        );

        return (
          <span
            className={
              formatted.isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }
          >
            {formatted.formatted}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => t("transactions.actions"),
      cell: ({ row }) => {
        const transaction = row.original;
        return (
          <div className="flex space-x-2">
            <EditTransaction transaction={transaction} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
              onClick={() => deleteTransaction(transaction.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedRows = Object.keys(rowSelection).length;

  // Bulletproof double-container: this outer div owns the visual
  // shell (border + bg + overflow-hidden clip); the inner overflow-x-auto
  // div further down owns the actual horizontal scroll. Keeping the
  // clip and the scroll on separate elements prevents the border from
  // being "leaked through" by inner content on browsers/layouts where
  // single-container overflow-x-auto + border+bg is ambiguous, and it's
  // also required for rounded-lg corners to clip child backgrounds.
  // `min-w-0` lets this wrapper shrink below the table's intrinsic
  // ~800px width when the flex ancestors collapse (MainLayout + main +
  // MainContent all set min-w-0 themselves in this same fix).
  return (
    <div className="glass-panel min-w-0 overflow-hidden rounded-xl">
      {selectedRows > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <span className="text-sm font-medium">
            {t("transactions.selected", { count: selectedRows })}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const selectedRowIds = table
                .getSelectedRowModel()
                .rows.map((row) => row.original.id);
              handleMultipleDelete({ rowSelection: selectedRowIds });
              setRowSelection({});
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {t("transactions.deleteSelected")}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200/80 dark:divide-white/[0.06]">
          <thead className="bg-slate-50/80 dark:bg-white/[0.025]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 cursor-pointer"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{
                      asc: <ArrowUp className="ml-1 h-3 w-3" />,
                      desc: <ArrowDown className="ml-1 h-3 w-3" />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.05] dark:bg-transparent">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="glow-row hover:bg-teal-500/[0.06] dark:hover:bg-teal-400/[0.06]"
              >
                {row.getVisibleCells().map((cell) => {
                  const isAmountCol = cell.column.id === "amount";
                  const value = cell.getValue<number>();
                  const amountColor =
                    isAmountCol && typeof value === "number"
                      ? value < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500 dark:text-slate-400";

                  return (
                    <td
                      key={cell.id}
                      className={`whitespace-nowrap px-6 py-4 text-sm ${amountColor}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200/80 bg-white/60 px-4 py-3 dark:border-white/[0.06] dark:bg-transparent">
        <div className="md:flex gap-5 mx-2 justify-between sm:hidden">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {t("common.previous")}
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="ml-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {t("common.next")}
          </button>
        </div>

        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {t("common.page")}{" "}
            <strong>
              {table.getState().pagination.pageIndex + 1} {t("common.of")}{" "}
              {table.getPageCount()}
            </strong>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t("common.show")}
            </span>
            <Select
              size="sm"
              aria-label={t("common.show")}
              className="w-20"
              value={String(table.getState().pagination.pageSize)}
              onChange={(value) => table.setPageSize(Number(value))}
              options={[10, 20, 30, 40, 50].map((pageSize) => ({
                value: String(pageSize),
                label: String(pageSize),
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
