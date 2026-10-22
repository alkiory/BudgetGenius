import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { RootState } from "@adapters/store/rootStore";
import {
  BudgetCategory,
  BudgetType,
} from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface Props {
  category: BudgetCategory;
  budgetType: BudgetType;
  onAddManualAmount: (categoryId: number, amount: number) => void;
  onDeleteCategory: (category: BudgetCategory) => void;
}

export const EditableBudgetCategory: React.FC<Props> = ({
  category,
  budgetType,
  onAddManualAmount,
  onDeleteCategory,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;

  const targetCurrency = (settings?.currency || "EUR") as Currency;
  const isSavings = budgetType === "savings";

  const savedLabel = isSavings
    ? t("budgets.savedLabel")
    : t("budgets.spentLabel");
  const addLabel = isSavings ? t("budgets.addSaving") : t("budgets.addExpense");
  const inputLabel = isSavings
    ? t("budgets.addSaving")
    : t("budgets.addExpense");

  const amountInput = useDecimalInput({
    initial: undefined,
    currency: targetCurrency,
  });

  // Opens an empty buffer; the amount entered is added to the category's
  // manual baseline. For spending budgets this is an expense adjustment;
  // for savings budgets it is a deposit. Linked transactions are never
  // touched — the API adds them to the displayed total on read.
  const handleAddClick = () => {
    setIsEditing(true);
    amountInput.setText("");
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    amountInput.setText("");
  };

  const handleSaveClick = () => {
    if (!category) return;
    const parsed = amountInput.parseNumber();
    // No-op + close for empty / NaN / non-positive input so the user can
    // cancel by clearing the field and we never send a zero update.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIsEditing(false);
      amountInput.setText("");
      return;
    }

    onAddManualAmount(category.id as number, parsed);
    setIsEditing(false);
    amountInput.setText("");
  };

  const formattedSpent = currencyService.formatCurrency(
    category.spent,
    targetCurrency,
    false,
  );

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <Label htmlFor={`category-spent-${category.id}`} className="text-xs">
          {isEditing ? inputLabel : savedLabel}
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {formattedSpent.symbol}
          </span>
          {isEditing ? (
            <Input
              id={`category-spent-${category.id}`}
              type="text"
              inputMode="decimal"
              step={
                amountInput.precision === 0
                  ? 1
                  : 1 / 10 ** amountInput.precision
              }
              value={amountInput.text}
              onChange={(e) => amountInput.setText(e.target.value)}
              placeholder="0"
              aria-label={
                isSavings
                  ? t("budgets.addSavingAria", { category: category.name })
                  : t("budgets.spentLabelAria", { category: category.name })
              }
              className="pl-7"
            />
          ) : (
            <span className="pl-7">{formattedSpent.formatted}</span>
          )}
        </div>
        {isEditing && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isSavings
              ? t("budgets.addSavingCurrent", {
                  current: formattedSpent.formatted,
                })
              : t("budgets.addExpenseCurrent", {
                  current: formattedSpent.formatted,
                })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!isEditing ? (
          <Button
            variant={isSavings ? "primary" : "default"}
            size="sm"
            className={
              isSavings ? "bg-green-600 hover:bg-green-700" : undefined
            }
            onClick={handleAddClick}
          >
            {addLabel}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleSaveClick}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancelClick}>
              {t("common.cancel")}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCategory(category);
          }}
        >
          {t("common.delete")}
        </Button>
      </div>
    </div>
  );
};
