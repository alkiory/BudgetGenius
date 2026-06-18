import { HttpGoalRepository } from "@adapters/http/goal.repository";
import { Goal } from "@domain/dashboard/goals/goal.entity";
import { Modal } from "@presentation/components/modal/modal";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GoalForm } from "./goal-form";

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: Goal;
  refetchParent: () => void;
}

export function GoalModal({
  isOpen,
  onClose,
  goal,
  refetchParent,
}: GoalModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = !!goal;

  const { mutate: addGoal } = useMutation({
    mutationKey: ["add-goal"],
    mutationFn: HttpGoalRepository.createGoal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(
        data?._offline ? data.message : "Goal created successfully",
        3000,
        "goal-create",
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!data?._offline) {
        refetchParent();
      }
    },
    onError: () => {
      errorToast("Failed to create goal", 3000, "goal-create");
    },
  });

  const { mutate: updateGoal } = useMutation({
    mutationKey: ["update-goal"],
    mutationFn: HttpGoalRepository.updateGoal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(
        data?._offline ? data.message : "Goal updated successfully",
        3000,
        "goal-update",
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!data?._offline) {
        refetchParent();
      }
    },
    onError: () => {
      errorToast("Failed to update goal", 3000, "goal-update");
    },
  });

  const handleSubmit = (goalData: Omit<Goal, "id" | "status">) => {
    if (isEditing && goal) {
      updateGoal({ goalId: goal.id, dto: goalData });
    } else {
      addGoal({ dto: goalData });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t("goals.editGoal") : t("goals.createGoal")}
    >
      <GoalForm goal={goal} onSubmit={handleSubmit} onCancel={onClose} />
    </Modal>
  );
}
