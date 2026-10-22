import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { useFetchBudgets } from "@adapters/query/dashboard";
import { Budget } from "@domain/dashboard/budgets/budget.entity";
import { BudgetDetail } from "@presentation/components/dashboard/budgets/budget-detail";
import { BudgetList } from "@presentation/components/dashboard/budgets/budget-list";
import { BudgetModal } from "@presentation/components/dashboard/budgets/budget-modal";
import BudgetsLoading from "@presentation/components/dashboard/budgets/budgets-loading";
import { Button } from "@presentation/components/ui/button";
import { PageHeader } from "@presentation/components/ui/page-header";
import {
  confirmToast,
  errorToast,
  successToast,
} from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function BudgetsPage() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editSelectedBudget, setEditSelectedBudget] = useState<
    Budget | undefined
  >(undefined);
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>(
    undefined,
  );

  const queryClient = useQueryClient();

  const {
    data: budgets,
    isLoading,
    isSuccess: budgetsFetched,
    isRefetching,
    refetch: refetchBudgets,
  } = useFetchBudgets();

  // NOTE: no early return before the hooks below — the loading guard must
  // stay after every hook or React sees a changing hook order when the
  // first fetch resolves ("Rendered more hooks than during the previous
  // render").
  useEffect(() => {
    if (selectedBudget && budgets) {
      const updatedBudget = budgets.find((b) => b.id === selectedBudget.id);
      if (updatedBudget) {
        setSelectedBudget(updatedBudget);
      } else {
        setSelectedBudget(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets]);

  const handleCreateBudget = () => {
    setEditSelectedBudget(undefined);
    setIsModalOpen(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setEditSelectedBudget(budget);
    setIsModalOpen(true);
  };

  const handleSelectBudget = (budget: Budget) => {
    setSelectedBudget(budgets?.find((b) => b.id === budget.id));
  };

  const { mutate: deleteBudget } = useMutation({
    mutationKey: ["delete-budget"],
    mutationFn: HttpBudgetRepository.deleteBudget,
    onSuccess: (budgetId) => {
      if (selectedBudget?.id === budgetId) {
        setSelectedBudget(undefined);
      }
      successToast(t("budgets.deleteSuccess"), 3000, "budget-delete");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setIsModalOpen(false);
    },
    onError: () => {
      errorToast(t("budgets.deleteError"), 3000, "budget-delete");
    },
  });

  const handleDeleteBudget = (budgetId: string | number) => {
    confirmToast(t("budgets.deleteConfirm"), {
      onConfirm: () => deleteBudget(Number(budgetId)),
      labelCancel: t("common.cancel"),
      labelConfirm: t("common.delete"),
    });
  };

  if (isLoading) {
    return <BudgetsLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("budgets.title")}
        description={t("budgets.description")}
      >
        <Button
          variant="primary"
          onClick={handleCreateBudget}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          {t("budgets.createBudget")}
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        {budgetsFetched && (
          <div className="md:col-span-1">
            <BudgetList
              budgets={budgets}
              isLoading={isLoading}
              onBudgetSelect={handleSelectBudget}
              onEditBudget={handleEditBudget}
              onDeleteBudget={handleDeleteBudget}
            />
          </div>
        )}
        <div className="md:col-span-2">
          {budgetsFetched && (
            <BudgetDetail
              onEditBudget={handleEditBudget}
              selectedBudget={selectedBudget}
              isRefreshed={isRefetching}
              refetchBudgets={refetchBudgets}
            />
          )}
        </div>
      </div>

      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        budget={editSelectedBudget}
        refetchBudgets={refetchBudgets}
      />
    </div>
  );
}
