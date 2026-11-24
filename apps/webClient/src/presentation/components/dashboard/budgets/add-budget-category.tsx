import { RootState } from "@adapters/store/rootStore";
import { BUDGET_CATEGORY_OPTIONS } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Select } from "@presentation/components/ui/select";
import {
  CURRENCY_PRECISION_MAP,
  Currency,
  currencyService,
} from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function AddBudgetCategory({
  name,
  allocated,
  amountLabel,
  handleNewCategoryChange,
  onCategoryNameChange,
  handleAddCategorySubmit,
}: {
  name: string;
  allocated: string;
  amountLabel: string;
  handleNewCategoryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCategoryNameChange: (value: string) => void;
  handleAddCategorySubmit: () => void;
}) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "EUR") as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);
  const precision = CURRENCY_PRECISION_MAP[targetCurrency] ?? 2;
  const stepAttr = precision === 0 ? 1 : 1 / 10 ** precision;

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="new-category-name">
            {t("budgets.categoryField")}
          </Label>
          <Select
            id="new-category-name"
            name="name"
            value={name}
            onChange={onCategoryNameChange}
            placeholder={t("transactions.selectCategory")}
            options={[
              { value: "", label: t("transactions.selectCategory") },
              ...BUDGET_CATEGORY_OPTIONS.map((category) => ({
                value: category,
                label: t(`categories.${category.toLowerCase()}`),
              })),
            ]}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="new-category-allocated">{amountLabel}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {currencySymbol}
            </span>
            <Input
              id="new-category-allocated"
              type="text"
              inputMode="decimal"
              name="allocatedText"
              step={stepAttr}
              aria-label={amountLabel}
              value={allocated}
              onChange={handleNewCategoryChange}
              className="pl-7"
              required
            />
          </div>
        </div>
        <Button
          onClick={handleAddCategorySubmit}
          className="w-full sm:w-auto"
          type="button"
        >
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
}
