import { RootState } from "@adapters/store/rootStore";
import {
  TRANSACTION_CATEGORIES,
  Transaction,
} from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { errorToast } from "@presentation/utils/toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface AddTransactionFormProps {
  onSubmit: (transaction: Omit<Transaction, "id">) => void;
  onCancel: () => void;
}

export default function AddTransactionForm({
  onSubmit,
  onCancel,
}: AddTransactionFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const userCurrency = (userSetting?.settings?.currency || "USD") as Currency;
  const currencySymbol = currencyService.getSymbol(userCurrency);

  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense",
  );
  const [formData, setFormData] = useState<Omit<Transaction, "id">>({
    date: new Date(),
    category: "Other",
    description: "",
    amount: undefined as unknown as number,
    currency: userCurrency,
  });

  // Bug fix (separate amountInput string): mirrors the same fix as in
  // transaction-form.tsx. Without a raw input buffer, every `.` or `,`
  // the user typed was being erased on the next React render because
  // parseAmountInput returns the integer base, and the controlled
  // input would re-render with that integer — effectively blocking
  // decimals. The numeric submit value is computed once from this
  // buffer in handleSubmit.
  const [amountInput, setAmountInput] = useState<string>("");

  // The amount input has its own inline onChange that updates the raw
  // `amountInput` buffer. `handleChange` therefore only serves the
  // description/category fields — keep it dead-branch-free.
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-parse the raw input buffer at submit time so `10,15` resolves
    // to 10.15 and not 10 (the previous shape stored `formData.amount`
    // as the parsed number, so trailing separators were dropped).
    const parsedAtSubmit = currencyService.parseAmountInput(amountInput);
    const absAmount = Math.abs(parsedAtSubmit);

    if (Number.isNaN(absAmount) || absAmount === 0) {
      errorToast(t("transactions.zeroAmountMsg"), 3000, "invalid-amount");
      return;
    }

    if (
      !currencyService.validateAmount(absAmount, formData.currency as Currency)
    ) {
      errorToast(
        t("transactions.invalidCurrencyAmount"),
        3000,
        "invalid-amount",
      );
      return;
    }

    // Apply sign: expense → negative, income → positive
    const signedAmount = transactionType === "expense" ? -absAmount : absAmount;

    onSubmit({
      ...formData,
      amount: currencyService.normalizeAmount(
        signedAmount,
        formData.currency as Currency,
      ),
      date: new Date(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Income / Expense Toggle */}
      <div className="space-y-2">
        <Label>{t("transactions.type")}</Label>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setTransactionType("expense")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              transactionType === "expense"
                ? "bg-red-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {t("transactions.expense")}
          </button>
          <button
            type="button"
            onClick={() => setTransactionType("income")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              transactionType === "income"
                ? "bg-green-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {t("transactions.income")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{t("transactions.category")}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          <option value="Other">{t("categories.other")}</option>
          {TRANSACTION_CATEGORIES.filter(
            (category) => category !== "All" && category !== "Todos",
          ).map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("transactions.description")}</Label>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t("transactions.enterDescription")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">{t("transactions.amount")}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {currencySymbol}
          </span>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            // Controlled by the raw string buffer `amountInput` so the
            // user's keystrokes are preserved (the previous shape wiped
            // the dot/comma the user just pressed).
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
            }}
            className="pl-7"
            placeholder={t("common.amountPlaceholder")}
            required
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("transactions.amountHint")}
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">{t("transactions.addTransaction")}</Button>
      </div>
    </form>
  );
}
