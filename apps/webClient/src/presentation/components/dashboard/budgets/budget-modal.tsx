import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { Budget } from "@domain/dashboard/budgets/budget.entity";
import { Modal } from "@presentation/components/modal/modal";
import { successToast, errorToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BudgetForm } from "./budget-form";

/**
 * Stable API message for D2.1 (`BUDGET_WINDOW_OVERLAP` in
 * apps/api/src/application/dashboard/services/budget.service.ts). It is a
 * client-mappable identifier, like `email_in_use` on the auth redirect:
 * changing it on either side is a breaking change.
 */
const BUDGET_WINDOW_OVERLAP_MESSAGE =
  "Budget dates overlap an existing budget";

/**
 * Translates the known 409 into the localized explanation and falls back
 * to the API/transport message for anything else.
 */
const budgetErrorMessage = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
  overlapMessage: string,
  fallback: string,
): string => {
  const data = error?.response?.data;
  const apiMessage = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (error?.response?.status === 409 && apiMessage === BUDGET_WINDOW_OVERLAP_MESSAGE) {
    return overlapMessage;
  }

  const message = apiMessage || error?.message || fallback;
  return Array.isArray(message) ? message[0] : message;
};

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget;
  refetchBudgets?: () => void;
}

export function BudgetModal({
  isOpen,
  onClose,
  budget,
  refetchBudgets,
}: BudgetModalProps) {
  const { t } = useTranslation();
  const isEditing = !!budget;

  const queryClient = useQueryClient();

  const { mutate: addBudget } = useMutation({
    mutationKey: ["add-budget"],
    mutationFn: HttpBudgetRepository.createBudget,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(
        data?._offline ? data.message : t("budgets.createSuccess"),
        3000,
        "budget-create",
      );
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!data?._offline) {
        refetchBudgets?.();
      }
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      errorToast(
        budgetErrorMessage(
          error,
          t("budgets.windowOverlap"),
          t("budgets.createError"),
        ),
        5000,
        "budget-create",
      );
      console.error("Budget creation failed:", error);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const { mutate: updateBudget } = useMutation({
    mutationKey: ["update-budget"],
    mutationFn: HttpBudgetRepository.updateBudget,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(
        data?._offline ? data.message : t("budgets.updateSuccess"),
        3000,
        "budget-update",
      );
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!data?._offline) {
        refetchBudgets?.();
      }
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      errorToast(
        budgetErrorMessage(
          error,
          t("budgets.windowOverlap"),
          t("budgets.updateError"),
        ),
        5000,
        "budget-update",
      );
      console.error("Budget update failed:", error);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const handleSubmit = (budgetData: Partial<Budget>) => {
    if (isEditing && budget) {
      updateBudget({
        ...budgetData,
        id: budget.id,
      });
    } else {
      addBudget(budgetData);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t("budgets.editBudget") : t("budgets.createBudget")}
    >
      <BudgetForm budget={budget} onSubmit={handleSubmit} onCancel={onClose} />
    </Modal>
  );
}
