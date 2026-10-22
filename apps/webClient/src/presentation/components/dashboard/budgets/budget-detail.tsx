import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { useFetchBudgetCategories } from "@adapters/query/dashboard";
import { RootState } from "@adapters/store/rootStore";
import {
  Budget,
  BudgetCategory,
  BudgetType,
} from "@domain/dashboard/budgets/budget.entity";
import Loader from "@presentation/components/loader";
import { Button } from "@presentation/components/ui/button";
import { Currency, currencyService } from "@presentation/utils/currencyService";
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

  const [newCategory, setNewCategory] = useState<{
    name: string;
    allocatedText: string;
  }>({
    name: "",
    allocatedText: "0",
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const {
    data: categoryBudgets,
    isLoading,
    refetch: refetchCategories,
  } = useFetchBudgetCategories({
    budgetId: Number(activeBudget),
    name: undefined,
  });

  // Mutations invalidate the above query so list auto‑refreshes
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["budgetCategories", activeBudget],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, activeBudget]);

  // Funciones de mutación optimizadas con useCallback
  const handleAddCategorySuccess = useCallback(() => {
    successToast(t("budgets.categoryAdded"), 3000, "budget-category-add");
    // Reset to canonical empty defaults after a successful create.
    setNewCategory({
      name: "",
      allocatedText: "0",
    });
    invalidate();
    refetchBudgets?.();
    refetchCategories();
  }, [invalidate, refetchBudgets, refetchCategories, t]);

  const handleMutationErrorDetailed = useCallback(
    (error: unknown, operation: string) => {
      const err = error as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t("budgets.categoryError");
      const errorMsg = Array.isArray(message) ? message[0] : message;
      errorToast(errorMsg, 5000, `budget-category-${operation}`);
    },
    [t],
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
    onSuccess: () => {
      successToast(
        t("budgets.categoryUpdated"),
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
        t("budgets.categoryDeleted"),
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

  const budgetType: BudgetType = selectedBudget?.type ?? "spending";
  const isSavings = budgetType === "savings";
  const targetCurrency = (userSettings?.settings?.currency ||
    "EUR") as Currency;
  const amountLabel = isSavings
    ? t("budgets.goalLabel")
    : t("budgets.limitLabel");

  // Summary and chart data
  const totalAllocated = selectedBudget?.totalAllocated ?? 0;
  const totalSpent = selectedBudget?.totalSpent ?? 0;
  const remaining = totalAllocated - totalSpent;
  const percentSpent =
    totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const chartData = useMemo(
    () =>
      categoryBudgets?.map((c) => ({
        name: t(`categories.${c.name.toLowerCase()}`, {
          defaultValue: c.name,
        }),
        allocated: c.allocated,
        spent: c.spent,
        percentUsed: c.allocated > 0 ? (c.spent / c.allocated) * 100 : 0,
      })) || [],
    [categoryBudgets, t],
  );

  // Adds a manual amount on top of the existing manual baseline. For
  // spending budgets this is an expense adjustment; for savings budgets
  // it is a deposit toward the goal. Transaction spending is never
  // mutated here — the API layers it on top at read time.
  const onAddManualAmount = useCallback(
    (categoryId: number, amount: number) => {
      const category = categoryBudgets?.find((c) => c.id === categoryId);
      if (!category) return;

      // Legacy API responses have no manualSpent: derive it from the
      // displayed total minus the transaction-derived portion.
      const manualBase = Number(
        category.manualSpent ??
          Math.max(
            Number(category.spent ?? 0) -
              Number(category.transactionSpent ?? 0),
            0,
          ),
      );
      const newManual = currencyService.roundAmount(
        manualBase + amount,
        targetCurrency,
      );
      const projectedTotal = currencyService.roundAmount(
        Number(category.spent ?? 0) + amount,
        targetCurrency,
      );

      if (!isSavings && projectedTotal > category.allocated) {
        warningToast(
          t("budgets.overBudgetCategory", {
            category: category.name,
            amount: (projectedTotal - category.allocated).toFixed(2),
          }),
          5000,
          "budget-over",
        );
      } else if (isSavings && projectedTotal >= category.allocated) {
        infoToast(t("budgets.goalReached"), 3000, "budget-goal");
      } else if (!isSavings) {
        infoToast(t("budgets.budgetHealthy"), 3000, "budget-healthy");
      }
      updateBudgetCategory({ id: categoryId, manualSpent: newManual });
    },
    [updateBudgetCategory, categoryBudgets, t, isSavings, targetCurrency],
  );

  const handleAddCategoryClick = useCallback(() => {
    setIsAddingCategory((prevState) => !prevState);
  }, []);

  const handleNewCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewCategory((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleAddCategorySubmit = useCallback(() => {
    if (!user || !activeBudget) return;

    const categoryName = newCategory.name.trim();
    if (categoryName === "") return;

    const allocatedNum = currencyService.parseAmountInput(
      newCategory.allocatedText,
    );
    const allocated = Number.isFinite(allocatedNum)
      ? Math.max(0, allocatedNum)
      : 0;

    if (allocated === 0) return;

    addBudgetCategory({
      name: categoryName,
      budgetId: activeBudget,
      allocated,
      manualSpent: 0,
      spent: 0,
    });
  }, [user, activeBudget, newCategory, addBudgetCategory]);

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
        budgetType={budgetType}
      />

      {/* spending / savings by category */}
      <BudgetSpendingByCategory chartData={chartData} budgetType={budgetType} />

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
            {isSavings
              ? t("budgets.addSavingsCategory")
              : t("budgets.addCategory")}
          </Button>
        </div>

        {isAddingCategory && (
          <AddBudgetCategory
            name={newCategory.name}
            allocated={newCategory.allocatedText}
            amountLabel={amountLabel}
            handleNewCategoryChange={handleNewCategoryChange}
            handleAddCategorySubmit={handleAddCategorySubmit}
          />
        )}

        {/* list of categories */}
        {categoryBudgets && categoryBudgets?.length > 0 ? (
          <BudgetCategoryList
            categoryBudgets={categoryBudgets}
            budgetType={budgetType}
            onAddManualAmount={onAddManualAmount}
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
