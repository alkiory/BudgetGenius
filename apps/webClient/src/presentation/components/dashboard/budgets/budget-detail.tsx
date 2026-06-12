import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import { Budget, BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import Loader from "@presentation/components/loader";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { successToast, errorToast } from "@presentation/utils/toast";
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import BudgetHeader from "./budget-header";
import BudgetSummary from "./budget-summary";
import BudgetSpendingByCategory from "./budget-spending-ny-cat";
import BudgetCategoryList from "./category-list";
import AddBudgetCategory from "./add-budget-category";
import { useFetchBudgetCategories } from "@adapters/query/dashboard";

interface BudgetDetailProps {
  onEditBudget: (budget: Budget) => void;
  selectedBudget?: Budget;
  isRefreshed?: boolean;
  refetchBudgets?: () => void
}

export function BudgetDetail({ onEditBudget, selectedBudget, isRefreshed, refetchBudgets }: BudgetDetailProps) {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  const queryClient = useQueryClient();

  const activeBudget = selectedBudget?.id

  const [newCategory, setNewCategory] = useState<BudgetCategory>({ budgetId: 0, name: "", allocated: 0, spent: 0 });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const { data: categoryBudgets, isLoading, refetch: refetchCategories } = useFetchBudgetCategories({ budgetId: Number(activeBudget), name: "" })

  // Mutations invalidate the above query so list auto‑refreshes
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["budgetCategories", activeBudget] });
  }, [queryClient, activeBudget]);

  // Funciones de mutación optimizadas con useCallback
  const handleAddCategorySuccess = useCallback(() => {
    successToast("Budget category added successfully", 3000, "budget-category-add");
    setNewCategory({ budgetId: activeBudget ?? 0, name: "", allocated: 0, spent: 0 });
    invalidate()
    refetchBudgets?.();
    refetchCategories();
  }, [activeBudget, invalidate, refetchBudgets, refetchCategories]);

  const handleMutationError = useCallback((operation: string) => {
    errorToast(`Failed to ${operation} budget category`, 3000, `budget-category-${operation}`);
  }, []);

  const { mutate: addBudgetCategory } = useMutation({
    mutationKey: ["add-budget-category"],
    mutationFn: HttpBudgetRepository.createBudgetCategory,
    onSuccess: handleAddCategorySuccess,
    onError: () => handleMutationError("add"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  const { mutate: updateBudgetCategory } = useMutation({
    mutationKey: ["update-budget-category"],
    mutationFn: HttpBudgetRepository.updateBudgetCategory,
    onSuccess: () => {
      successToast("Budget category updated successfully", 3000, "budget-category-update")
      invalidate()
    },
    onError: () => handleMutationError("update"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  const { mutate: deleteBudgetCategory } = useMutation({
    mutationKey: ["delete-budget-category"],
    mutationFn: HttpBudgetRepository.deleteBudgetCategory,
    onSuccess: () => {
      successToast("Budget category deleted successfully", 3000, "budget-category-delete")
      invalidate()
    },
    onError: () => handleMutationError("delete"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  // Summary and chart data
  const totalAllocated = selectedBudget?.totalAllocated ?? 0
  const totalSpent = selectedBudget?.totalSpent ?? 0
  const remaining = totalAllocated - totalSpent
  const percentSpent = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0

  const chartData = useMemo(() => categoryBudgets?.map(c => ({
    name: c.name,
    allocated: c.allocated,
    spent: c.spent,
    percentUsed: c.allocated > 0 ? (c.spent / c.allocated) * 100 : 0
  })) || [], [categoryBudgets])

  // Handlers optimizados con useCallback
  const onUpdateSpent = useCallback((categoryId: number, spent: number) => {
    updateBudgetCategory({ id: categoryId, spent });
  }, [updateBudgetCategory]);

  const handleAddCategoryClick = useCallback(() => {
    setIsAddingCategory((prevState) => !prevState);
  }, []);

  const handleNewCategoryChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCategory((prev) => ({
      ...prev,
      [name]: name === "allocated" || name === "spent" ? Number(value) : value,
    }));
  }, []);

  const handleAddCategorySubmit = useCallback(() => {
    if (!user || !activeBudget) return;

    if (newCategory.name.trim() === "" || !newCategory.allocated) return;

    addBudgetCategory({ ...newCategory, budgetId: activeBudget });
  }, [user, activeBudget, newCategory, addBudgetCategory]);

  const onDeleteCategoryHandler = useCallback((categoryToDelete: BudgetCategory) => {
    deleteBudgetCategory(categoryToDelete.id as number);
  }, [deleteBudgetCategory]);

  const handleEditBudgetClick = useCallback(() => {
    if (activeBudget && selectedBudget) {
      onEditBudget(selectedBudget);
    }
  }, [activeBudget, onEditBudget, selectedBudget]);

  // Render condicional del loader más legible
  if (isRefreshed || isLoading) {
    return <Loader />;
  }

  if (!activeBudget) {
    return (
      <div className="md:mt-11 rounded-lg border border-dashed bg-purple-50 p-6 text-center dark:border-purple-900/30 dark:bg-purple-900/20 md:p-10 lg:p-16 xl:p-20 border-slate-200 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">{t('common.selectBudget')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Header */}
      <BudgetHeader
        name={selectedBudget?.name ?? ""}
        startDate={selectedBudget?.startDate ?? new Date()}
        endDate={selectedBudget?.endDate ?? new Date()}
        period={selectedBudget?.period ?? ""}
        handleEditBudgetClick={handleEditBudgetClick}
      />

      {/* Budget Summary */}
      <BudgetSummary
        totalAllocated={selectedBudget?.totalAllocated ?? 0}
        totalSpent={selectedBudget?.totalSpent ?? 0}
        remaining={remaining} percentSpent={percentSpent}
      />

      {/* spending by category */}
      <BudgetSpendingByCategory chartData={chartData} />

      {/* budget categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('common.budgetCategories')}</h3>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleAddCategoryClick}>
            <Plus className="h-4 w-4" />
            {t('budgets.addCategory')}
          </Button>
        </div>

        {isAddingCategory && (
          <AddBudgetCategory
            name={newCategory.name}
            allocated={String(newCategory.allocated)}
            spent={String(newCategory.spent)}
            handleNewCategoryChange={handleNewCategoryChange}
            handleAddCategorySubmit={handleAddCategorySubmit}
          />
        )}

        {/* list of categories */}
        {categoryBudgets && categoryBudgets?.length > 0 ? (
          <BudgetCategoryList
            categoryBudgets={categoryBudgets}
            onUpdateSpent={onUpdateSpent}
            onDeleteCategoryHandler={onDeleteCategoryHandler}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">{t('budgets.noCategoriesYet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}