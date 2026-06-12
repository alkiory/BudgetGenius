import { useTranslation } from 'react-i18next';
import { HttpSavingRepository } from "@adapters/http/saving-goal.repository"
import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { SavingGoalForm } from "./saving-goal-form"

export default function AddSavingGoalButton() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const { mutate: addGoal, isIdle } = useMutation({
    mutationKey: ['add-goal'],
    mutationFn: HttpSavingRepository.createSavingGoal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "saving-goal-create")
      queryClient.invalidateQueries({ queryKey: ["saving-goals"] })
      setIsOpen(false)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      errorToast(error.response.data.message, 3000, "saving-goal-create")
      setIsOpen(true)
    }
  })

  const handleAddGoal = (goal: Omit<SavingGoal, "id" | "percentage">) => {
    addGoal({ dto: goal })
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1">
        <Plus className="h-4 w-4" />
        {t('savings.addGoal')}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('savings.addNewSavingGoal')}>
        <SavingGoalForm isLoading={isIdle} onSubmit={handleAddGoal} onCancel={() => setIsOpen(false)} />
      </Modal>
    </>
  )
}