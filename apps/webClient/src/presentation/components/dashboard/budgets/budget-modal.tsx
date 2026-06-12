import { useTranslation } from 'react-i18next';
import { Modal } from "@presentation/components/modal/modal"
import { BudgetForm } from "./budget-form"
import { Budget } from "@domain/dashboard/budgets/budget.entity"
import { HttpBudgetRepository } from "@adapters/http/budget.repository"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import PremiumCard from "@presentation/components/modal/premium-card"
import { useState } from "react"

interface BudgetModalProps {
  isOpen: boolean
  onClose: () => void
  budget?: Budget
  refetchBudgets?: () => void
}

export function BudgetModal({ isOpen, onClose, budget, refetchBudgets }: BudgetModalProps) {
  const { t } = useTranslation();
  const isEditing = !!budget

  const queryClient = useQueryClient()

  const [showPremiumCard, setShowPremiumCard] = useState(false);

  const handleClosePremiumCard = () => {
    setShowPremiumCard(false);
    onClose();
  };

  const { mutate: addBudget } = useMutation({
    mutationKey: ['add-budget'],
    mutationFn: HttpBudgetRepository.createBudget,
    onSuccess: () => {
      successToast(t('budgets.createSuccess'), 3000, "budget-create");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      refetchBudgets?.();
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      if (error.response && error.response.status === 403) {
        setShowPremiumCard(true);
      } else {
        errorToast(t('budgets.createError'), 3000, "budget-create");
        console.error("Budget creation failed:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    }
  })

  const { mutate: updateBudget } = useMutation({
    mutationKey: ['update-budget'],
    mutationFn: HttpBudgetRepository.updateBudget,
    onSuccess: () => {
      successToast(t('budgets.updateSuccess'), 3000, "budget-update")
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      refetchBudgets?.()
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      if (error.response && error.response.status === 403) {
        setShowPremiumCard(true);
      } else {
        errorToast(t('budgets.updateError'), 3000, "budget-update");
        console.error("Budget update failed:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
    }
  })

  const handleSubmit = (budgetData: Partial<Budget>) => {
    if (isEditing && budget) {
      updateBudget({
        ...budgetData,
        id: budget.id,
      })
    } else {
      addBudget(budgetData)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? t('budgets.editBudget') : t('budgets.createBudget')}>

      {!showPremiumCard && (
        <BudgetForm budget={budget} onSubmit={handleSubmit} onCancel={onClose} />
      )}

      {showPremiumCard && (
        <PremiumCard
          onClose={handleClosePremiumCard}
          message={t('upgrade.premiumFeature')}
        />
      )}
    </Modal>
  )
}