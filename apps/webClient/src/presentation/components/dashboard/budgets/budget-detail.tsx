import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { useFetchBudgetCategories } from "@adapters/query/dashboard";
import { RootState } from "@adapters/store/rootStore";
import {
  Budget,
  BudgetCategory,
} from "@domain/dashboard/budgets/budget.entity";
import Loader from "@presentation/components/loader";
import { Button } from "@presentation/components/ui/button";
import {
  successToast,
  errorToast,
  warningToast,
  infoToast,
} from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import AddBudgetCategory from "./add-budget-category";
import BudgetHeader from "./budget-header";
import BudgetSpendingByCategory from "./budget-spending-ny-cat";
import BudgetSummary from "./budget-summary";
import BudgetCategoryList from "./category-list";

interface BudgetDetailProps {
  onEditBudget: (budget: Budget) => void;
  selectedBudget?: Budget;
  isRefreshed?: boolean;
  refetchBudgets?: () => void;
}

export function BudgetDetail({
  onEditBudget,
  selectedBudget,
  isRefreshed,
  refetchBudgets,
}: BudgetDetailProps) {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const queryClient = useQueryClient();

  const activeBudget = selectedBudget?.id;

  // Bug fix (#NaN-total): initialize amounts to 0 (not `undefined`) so
  // the totals reducer in BudgetForm / Display never produces NaN.
  const [newCategory, setNewCategory] = useState<BudgetCategory>({
    budgetId: 0,
    name: "",
    allocated: 0,
    spent: 0,
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const {
    data: categoryBudgets,
    isLoading,
    refetch: refetchCategories,
  } = useFetchBudgetCategories({ budgetId: Number(activeBudget), name: "" });

  // Mutations invalidate the above query so list auto‑refreshes
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["budgetCategories", activeBudget],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, activeBudget]);

  // Funciones de mutación optimizadas con useCallback
  const handleAddCategorySuccess = useCallback(() => {
    successToast(
      "Budget category added successfully",
      3000,
      "budget-category-add",
    );
    // Bug fix (#NaN-total): reset amounts to 0 (not `undefined`).
    setNewCategory({
      budgetId: activeBudget ?? 0,
      name: "",
      allocated: 0,
      spent: 0,
    });
    invalidate();
    refetchBudgets?.();
    refetchCategories();
  }, [activeBudget, invalidate, refetchBudgets, refetchCategories]);

  const handleMutationErrorDetailed = useCallback(
    (error: any, operation: string) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        `Failed to ${operation} budget category`;
      const errorMsg = Array.isArray(message) ? message[0] : message;
      errorToast(errorMsg, 5000, `budget-category-${operation}`);
    },
    [],
  );

  const { mutate: addBudgetCategory } = useMutation({
    mutationKey: ["add-budget-category"],
    mutationFn: HttpBudgetRepository.createBudgetCategory,
    onSuccess: handleAddCategorySuccess,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => handleMutationErrorDetailed(error, "add"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  const { mutate: updateBudgetCategory } = useMutation({
    mutationKey: ["update-budget-category"],
    mutationFn: HttpBudgetRepository.updateBudgetCategory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (_data: any) => {
      successToast(
        "Budget category updated successfully",
        3000,
        "budget-category-update",
      );
      invalidate();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => handleMutationErrorDetailed(error, "update"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  const { mutate: deleteBudgetCategory } = useMutation({
    mutationKey: ["delete-budget-category"],
    mutationFn: HttpBudgetRepository.deleteBudgetCategory,
    onSuccess: () => {
      successToast(
        "Budget category deleted successfully",
        3000,
        "budget-category-delete",
      );
      invalidate();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => handleMutationErrorDetailed(error, "delete"),
    onSettled: () => {
      refetchBudgets?.();
      refetchCategories();
    },
  });

  // Summary and chart data
  const totalAllocated = selectedBudget?.totalAllocated ?? 0;
  const totalSpent = selectedBudget?.totalSpent ?? 0;
  const remaining = totalAllocated - totalSpent;
  const percentSpent =
    totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const chartData = useMemo(
    () =>
      categoryBudgets?.map((c) => ({
        name: c.name,
        allocated: c.allocated,
        spent: c.spent,
        percentUsed: c.allocated > 0 ? (c.spent / c.allocated) * 100 : 0,
      })) || [],
    [categoryBudgets],
  );

  // Handlers optimizados con useCallback
  const onUpdateSpent = useCallback(
    (categoryId: number, spent: number) => {
      // Bug fix (#currency-edit-mangling): persist the user-entered amount
      // as-is. The previous flow converted display currency → USD before
      // saving, which broke round-trip on re-edit (2000 EUR → 2150 USD
      // stored, then re-displayed as 2150 regardless of the user's display
      // choice). Display paths read the value as a no-op identity
      // conversion (source = targetCurrency).
      const normalizedSpent = spent;

      // Check if new spent exceeds allocated & show friendly warning
      const category = categoryBudgets?.find((c) => c.id === categoryId);
      if (category && normalizedSpent > category.allocated) {
        const overAmount = normalizedSpent - category.allocated;
        warningToast(
          t("budgets.overBudgetCategory", {
            category: category.name,
            amount: overAmount.toFixed(2),
          }),
          5000,
          "budget-over",
        );
      } else if (
        category &&
        normalizedSpent >= 0 &&
        normalizedSpent <= category.allocated
      ) {
        infoToast(t("budgets.budgetHealthy"), 3000, "budget-healthy");
      }
      updateBudgetCategory({ id: categoryId, spent: normalizedSpent });
    },
    [updateBudgetCategory, categoryBudgets, t, userSettings],
  );

  const handleAddCategoryClick = useCallback(() => {
    setIsAddingCategory((prevState) => !prevState);
  }, []);

  const handleNewCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      // Bug fix (#NaN-total): empty input maps to 0 (not `undefined`) so
      // the totals computation never goes to NaN. The number input still
      // renders blank because of `value={allocated ?? ""}` in the JSX.
      setNewCategory((prev) => ({
        ...prev,
        [name]:
          name === "allocated" || name === "spent"
            ? Number(value) || 0
            : value,
      }));
    },
    [],
  );

  const handleAddCategorySubmit = useCallback(() => {
    if (!user || !activeBudget) return;

    if (newCategory.name.trim() === "" || !newCategory.allocated) return;

    // Bug fix (#currency-edit-mangling): persist amount as-entered. See
    // the matching comment in `BudgetForm.handleSubmit`.
    addBudgetCategory({
      ...newCategory,
      budgetId: activeBudget,
      allocated: Number(newCategory.allocated) || 0,
      spent: Number(newCategory.spent) || 0,
    });
  }, [user, activeBudget, newCategory, addBudgetCategory, userSettings]);

  const onDeleteCategoryHandler = useCallback(
    (categoryToDelete: BudgetCategory) => {
      deleteBudgetCategory(categoryToDelete.id as number);
    },
    [deleteBudgetCategory],
  );

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
        <p className="text-slate-500 dark:text-slate-400">
          {t("common.selectBudget")}
        </p>
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
        remaining={remaining}
        percentSpent={percentSpent}
      />

      {/* spending by category */}
      <BudgetSpendingByCategory chartData={chartData} />

      {/* budget categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {t("common.budgetCategories")}
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleAddCategoryClick}
          >
            <Plus className="h-4 w-4" />
            {t("budgets.addCategory")}
          </Button>
        </div>

        {isAddingCategory && (
          <AddBudgetCategory
            name={newCategory.name}
            allocated={newCategory.allocated?.toString() ?? ""}
            spent={newCategory.spent?.toString() ?? ""}
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
            <p className="text-slate-500 dark:text-slate-400">
              {t("budgets.noCategoriesYet")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
