import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  createColumnHelper,
} from '@tanstack/react-table';
import { Transaction } from '@domain/dashboard/transactions/transaction.entity';
import { Check, X, Trash2, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from './button';
import { EditTransaction } from '../dashboard/transaction/edit-transaction';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HttpTransactionRepository } from '@adapters/http/transaction.repository';
import { successToast, errorToast, warningToast } from '@presentation/utils/toast';
import { validateTransactionSelection } from '@domain/dashboard/transactions/validateTransactionSelection';
import { Currency, currencyService } from '@presentation/utils/currencyService';
import { useSelector } from 'react-redux';
import { RootState } from '@adapters/store/rootStore';

export default function Table({ data }: { data: Transaction[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [rowSelection, setRowSelection] = useState({})

  const queryClient = useQueryClient()

  const columnHelper = createColumnHelper<Transaction>()

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting


  const { mutate: deleteAllTransactions } = useMutation({
    mutationKey: ['delete-all-transactions'],
    mutationFn: HttpTransactionRepository.deleteAllTransactions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-delete")
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-delete")
    }
  })

  const handleMultipleDelete = ({ rowSelection }: { rowSelection: number[] }) => {
    if (!validateTransactionSelection(rowSelection)) {
      warningToast("No transactions selected", 3000, "transaction-delete")
      return;
    }

    deleteAllTransactions(rowSelection)
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  const { mutate: deleteTransaction } = useMutation({
    mutationKey: ['delete-transaction'],
    mutationFn: HttpTransactionRepository.deleteTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-delete")
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-delete")
    }

  })

  const columns = [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <div className="px-1">
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-purple-600"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="px-1">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-purple-600"
          />
        </div>
      ),
    }),
    columnHelper.accessor("date", {
      header: "Date",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("category", {
      header: "Category",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("amount", {
      header: "Amount",
      cell: (info) => {
        const transaction = info.row.original;
        const targetCurrency = (settings?.currency || 'USD') as Currency;
        const formatted = currencyService.formatCurrency(
          transaction.amount,
          transaction.currency as Currency,
          targetCurrency
        );

        return (
          <span className={formatted.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {formatted.formatted}
          </span>
        )
      },
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const status = info.getValue()
        let statusClass = ""
        let statusIcon = null

        switch (status) {
          case "Completed":
            statusClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            statusIcon = <Check className="mr-1 h-3 w-3" />
            break
          case "Pending":
            statusClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            break
          case "Cancelled":
            statusClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            statusIcon = <X className="mr-1 h-3 w-3" />
            break
          default:
            statusClass = "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        }

        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
            {statusIcon}
            {status}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <div className="flex space-x-2">
            <EditTransaction transaction={transaction} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              onClick={() => deleteTransaction(transaction.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
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

  const selectedRows = Object.keys(rowSelection).length

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {selectedRows > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <span className="text-sm font-medium">
            {selectedRows} {selectedRows === 1 ? "transaction" : "transactions"} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const selectedRowIds = table.getSelectedRowModel().rows.map((row) => row.original.id)
              handleMultipleDelete({ rowSelection: selectedRowIds })
              setRowSelection({})
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete Selected
          </Button>
        </div>
      )}
      <div className="overflow-x-auto max-w-[90vw]">
        <table className="w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 cursor-pointer"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: <ArrowUp className="ml-1 h-3 w-3" />,
                      desc: <ArrowDown className="ml-1 h-3 w-3" />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                {row.getVisibleCells().map(cell => {
                  const isAmountCol = cell.column.id === 'amount';
                  const value = cell.getValue<number>();
                  const amountColor =
                    isAmountCol && typeof value === 'number'
                      ? value < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                      : 'text-slate-500 dark:text-slate-400';

                  return (
                    <td
                      key={cell.id}
                      className={`whitespace-nowrap px-6 py-4 text-sm ${amountColor}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="md:flex gap-5 mx-2 justify-between sm:hidden">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Anterior
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="ml-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Siguiente
          </button>
        </div>

        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Página{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </strong>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="pageSize" className="text-sm text-slate-700 dark:text-slate-300">
              Mostrar
            </label>
            <select
              id="pageSize"
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              {[10, 20, 30, 40, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
