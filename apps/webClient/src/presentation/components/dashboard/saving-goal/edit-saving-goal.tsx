import { useTranslation } from 'react-i18next';
import { HttpSavingRepository } from "@adapters/http/saving-goal.repository"
import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { SavingGoalForm } from "./saving-goal-form"

interface EditSavingGoalButtonProps {
  goal: SavingGoal
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  children?: React.ReactNode
}

export default function EditSavingGoalButton({ goal, variant = "ghost", size = "icon", children }: EditSavingGoalButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false)

  const queryClient = useQueryClient()

  const { mutate: updateGoal } = useMutation({
    mutationKey: ['update-goal'],
    mutationFn: HttpSavingRepository.updateSavingGoal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "saving-goal-update")
      queryClient.invalidateQueries({ queryKey: ["saving-goals"] })
      setIsOpen(false)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      errorToast(error.response.data.message, 3000, "saving-goal-update")
      setIsOpen(true)
    }
  })

  const handleUpdateGoal = (updatedGoal: Omit<SavingGoal, "id" | "percentage">) => {
    updateGoal({ dto: { ...updatedGoal, id: goal.id } })
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant={variant} size={size}>
        {children || <Pencil className="h-4 w-4" />}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('savings.editGoal')}>
        <SavingGoalForm goal={goal} onSubmit={handleUpdateGoal} onCancel={() => setIsOpen(false)} />
      </Modal>
    </>
  )
}