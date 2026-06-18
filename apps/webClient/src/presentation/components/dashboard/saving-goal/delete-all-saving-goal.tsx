import { useTranslation } from 'react-i18next';
import { useState } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HttpSavingRepository } from "@adapters/http/saving-goal.repository"
import { successToast, errorToast } from "@presentation/utils/toast"
import { useSelector } from "react-redux"
import { useFetchSavings } from "@adapters/query/dashboard"
import { RootState } from "@adapters/store/rootStore"

export function DeleteAllSavingGoalsButton() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user)
  const [isOpen, setIsOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: goals, isSuccess: goalsFetched } = useFetchSavings()

  const { mutate: deleteAllGoals } = useMutation({
    mutationKey: ["delete-all-saving"],
    mutationFn: HttpSavingRepository.deleteAllSavingGoals,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data?._offline ? data.message : t('savings.deletedSuccess'), 3000, "saving-goal-delete")
      queryClient.invalidateQueries({ queryKey: ["saving-goals"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setIsOpen(false)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      errorToast(error.response.data.message, 3000, "saving-goal-delete")
      setIsOpen(true)
    }
  })

  const handleDeleteAll = () => {
    if (!user) return

    deleteAllGoals()
    setIsOpen(false)
  }

  if (goalsFetched && goals.length === 0) return null

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="sm"
        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
      >
        <Trash2 className="mr-1 h-4 w-4" />
        {t('savings.deleteAll')}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('savings.deleteAllTitle')}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p dangerouslySetInnerHTML={{ __html: t('savings.deleteAllConfirm', { count: goalsFetched ? goals.length : 0 }) }} />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteAll}>
              {t('savings.deleteAll')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
