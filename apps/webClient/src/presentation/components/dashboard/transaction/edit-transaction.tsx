import { useTranslation } from 'react-i18next';
import { HttpTransactionRepository } from "@adapters/http/transaction.repository"
import { Transaction } from "@domain/dashboard/transactions/transaction.entity"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { TransactionForm } from "./transaction-form"

interface EditTransactionButtonProps {
  transaction: Transaction
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  children?: React.ReactNode
}

export function EditTransaction({ transaction, variant = "ghost", children }: EditTransactionButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false)

  const queryClient = useQueryClient()

  const { mutate: updateTransaction } = useMutation({
    mutationKey: ['add-transaction'],
    mutationFn: HttpTransactionRepository.updateTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-create")
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-create")
    }
  })

  const handleUpdateTransaction = (updatedTransaction: Partial<Transaction>) => {
    if (updatedTransaction.id === undefined) {
      errorToast(t('transactions.idRequired'), 3000, "transaction-update")
      return
    }
    updateTransaction({
      dto: {
        ...updatedTransaction,
        amount: Number(updatedTransaction.amount)
      }
    })
    setIsOpen(false)
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant={variant} size="icon" className="h-8 w-8 p-0">
        {children || <Pencil className="h-4 w-4" />}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('transactions.editTransaction')}>
        <TransactionForm
          transaction={transaction}
          onSubmit={handleUpdateTransaction}
          onCancel={() => setIsOpen(false)}
        />
      </Modal>
    </>
  )
}