import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Plus } from "lucide-react"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import AddTransactionForm from "./add-transaction"
import { HttpTransactionRepository } from "@adapters/http/transaction.repository"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Transaction } from "@domain/dashboard/transactions/transaction.entity"

export function AddTransactionModal({ isHeader }: { isHeader?: boolean }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false)

  const queryClient = useQueryClient()

  const { mutate: addTransaction } = useMutation({
    mutationKey: ['add-transaction'],
    mutationFn: HttpTransactionRepository.createTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, 'transaction-create');
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setIsOpen(false)
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-create")
    }
  })

  const handleAddTransaction = (transaction: Omit<Transaction, "id">) => {
    if (transaction.amount === 0) {
      errorToast("Amount cannot be 0", 3000, "invalid-amount")
      return
    }

    addTransaction({
      dto: {
        ...transaction,
      }
    })
  }

  return (
    <>
      {!isHeader ? (
        <>
          <Button
            variant="primary"
            onClick={() => setIsOpen(true)}
            size="lg"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-base font-semibold shadow-md hover:shadow-lg transition-all">
            <Plus className="h-5 w-5" />
            {t('transactions.addTransaction')}
          </Button>

          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="">
            <AddTransactionForm onSubmit={handleAddTransaction} onCancel={() => setIsOpen(false)} />
          </Modal>
        </>
      ) : (
        <>
          <Button
            variant="primary"
            onClick={() => setIsOpen(true)}
            size="icon"
            className="rounded-full bg-purple-50 p-1 text-purple-600 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:bg-slate-800 dark:text-purple-400 dark:hover:text-purple-300"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('transactions.addNewTransaction')}>
            <AddTransactionForm onSubmit={handleAddTransaction} onCancel={() => setIsOpen(false)} />
          </Modal>
        </>
      )}
    </>
  )
}
