import { useTranslation } from 'react-i18next';
import { Income } from "@domain/dashboard/incomes/income.entity"
import { IncomeForm } from "./income-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { successToast, errorToast } from "@presentation/utils/toast"
import { Modal } from "@presentation/components/modal/modal"
import { HttpIncomeRepository } from "@adapters/http/income.repository"
import { Currency, currencyService } from "@presentation/utils/currencyService"

interface IncomeModalProps {
  isOpen: boolean
  onClose: () => void
  income?: Income
}

export function IncomeModal({ isOpen, onClose, income }: IncomeModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient()

  const { mutate: addIncome } = useMutation({
    mutationKey: ['add-income'],
    mutationFn: HttpIncomeRepository.createIncome,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "income-create")
      queryClient.invalidateQueries({ queryKey: ["incomes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "income-create")
    }
  })

  const { mutate: updateIncome } = useMutation({
    mutationKey: ['update-income'],
    mutationFn: HttpIncomeRepository.updateIncome,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "income-create")
      queryClient.invalidateQueries({ queryKey: ["incomes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: (error) => {
      errorToast(error.message, 3000, "income-create")
    }
  })

  const isEditing = !!income

  const handleSubmit = (incomeData: Partial<Income>) => {
    // Ensure amount is positive for income
    const positiveAmount = Math.abs(incomeData.amount || 0)

    if (isEditing && income) {
      updateIncome({ dto: { ...incomeData, amount: positiveAmount, id: income.id, date: incomeData.date || new Date() } })
    } else {
      addIncome({
        dto: {
          // amount: positiveAmount,
          amount: currencyService.normalizeAmount(positiveAmount, incomeData.currency as Currency),
          date: incomeData.date || new Date(),
          category: incomeData.category || "Other",
          currency: incomeData.currency || "USD",
          description: incomeData.description || "No description",
          recurrence: incomeData.recurrence || "One-time",
        }
      })
    }

    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? t('income.editIncomeSource') : t('income.addIncomeSource')}>
      <IncomeForm income={income} onSubmit={handleSubmit} onCancel={onClose} />
    </Modal>
  )
}
