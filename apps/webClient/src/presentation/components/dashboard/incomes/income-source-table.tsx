import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table"
import { Trash2, Pencil, ArrowDown, ArrowUp } from "lucide-react"
import { IncomeModal } from "./income-modal"
import { Income } from "@domain/dashboard/incomes/income.entity"
import { Button } from "@presentation/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HttpIncomeRepository } from "@adapters/http/income.repository"
import { successToast, errorToast } from "@presentation/utils/toast"
import { RootState } from "@adapters/store/rootStore"
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { useSelector } from "react-redux"

interface IncomeSourcesTableProps {
  incomeTransactions: Income[]
}

export function IncomeSourcesTable({ incomeTransactions }: IncomeSourcesTableProps) {
  const queryClient = useQueryClient()
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const { mutate: deleteTransaction } = useMutation({
    mutationKey: ["delete-transaction"],
    mutationFn: HttpIncomeRepository.deleteIfOwned,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "income-delete")
      queryClient.invalidateQueries({ queryKey: ["incomes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "income-delete")
      queryClient.invalidateQueries({ queryKey: ["incomes"] })
    },
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [editingTransaction, setEditingTransaction] = useState<Income | null>(null)

  const columnHelper = createColumnHelper<Income>()

  const columns = [
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
        const amount = info.getValue()

        const targetCurrency = (settings?.currency || 'USD') as Currency;
        const formattedAmount = currencyService.formatCurrency(
          amount,
          targetCurrency as Currency,
          targetCurrency,
          false
        );

        return <span className="text-green-600 dark:text-green-400">{formattedAmount.formatted}</span>
      },
    }),
    columnHelper.accessor("recurrence", {
      header: "Recurrence",
      cell: (info) => info.getValue(),
    }),
    // columnHelper.accessor("status", {
    //   header: "Status",
    //   cell: (info) => {
    //     const status = info.getValue()
    //     let statusClass = ""

    //     switch (status) {
    //       case "Completed":
    //         statusClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    //         break
    //       case "Pending":
    //         statusClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    //         break
    //       case "Cancelled":
    //         statusClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    //         break
    //       default:
    //         statusClass = "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
    //     }

    //     return (
    //       <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>{status}</span>
    //     )
    //   },
    // }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const transaction = row.original
        return (
          <div className="space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => setEditingTransaction(transaction)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
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
  ]

  const table = useReactTable({
    data: incomeTransactions,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto max-w-[90vw]">
          <table className="w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 cursor-pointer
                        }`}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ArrowUp className="ml-1 h-3 w-3" />,
                            desc: <ArrowDown className="ml-1 h-3 w-3" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-6 py-4 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-1 justify-between sm:hidden">
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} variant="outline" size="sm">
              Next
            </Button>
          </div>

          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Showing{" "}
                <span className="font-medium">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    incomeTransactions.length,
                  )}
                </span>{" "}
                of <span className="font-medium">{incomeTransactions.length}</span> results
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="pageSize" className="text-sm text-slate-700 dark:text-slate-300">
                Show
              </label>
              <select
                id="pageSize"
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {editingTransaction && (
        <IncomeModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          income={editingTransaction}
        />
      )}
    </>
  )
}
