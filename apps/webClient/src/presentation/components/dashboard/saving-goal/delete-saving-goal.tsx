import { useTranslation } from 'react-i18next';
import { HttpSavingRepository } from "@adapters/http/saving-goal.repository"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2, AlertTriangle } from "lucide-react"
import { useState } from "react"

interface DeleteSavingGoalButtonProps {
  goalId: number
  goalName: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  children?: React.ReactNode
}

export default function DeleteSavingGoalButton({
  goalId,
  goalName,
  variant = "ghost",
  size = "icon",
  children,
}: DeleteSavingGoalButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false)

  const queryClient = useQueryClient()

  const { mutate: deleteGoal } = useMutation({
    mutationKey: ["delete-saving"],
    mutationFn: HttpSavingRepository.deleteSavingGoal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "saving-goal-delete")
      queryClient.invalidateQueries({ queryKey: ["saving-goals"] })
      setIsOpen(false)
    },
    onError: (error) => {
      errorToast(error.message, 3000, "saving-goal-delete")
      setIsOpen(true)
    }
  })

  const handleDelete = () => {
    deleteGoal(goalId)
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={variant}
        size={size}
        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
      >
        {children || <Trash2 className="h-4 w-4" />}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('savings.deleteGoal')}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p dangerouslySetInnerHTML={{ __html: t('savings.deleteConfirm', { name: goalName }) }} />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              {t('savings.deleteGoal')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}