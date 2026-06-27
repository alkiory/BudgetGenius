import { RootState } from "@adapters/store/rootStore";
import {
  INCOME_RECURRENCES,
  IncomeRecurrence,
  TRANSACTION_CATEGORIES,
  Transaction,
  TransactionPatch,
} from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { errorToast } from "@presentation/utils/toast";
import { useState, useEffect } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (transaction: TransactionPatch) => void;
  onCancel: () => void;
}

// Phase 3 (T3.5): "One-time" represents the default no-recurrence label.
// The backend stores `null` for non-recurring rows; the frontend maps an
// empty select / the One-time sentinel to `null` on submit.
const ONE_TIME_LABEL = "One-time";

export function TransactionForm({
  transaction,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "USD") as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);

  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense",
  );
  const [formData, setFormData] = useState<Transaction>({
    id: 0,
    date: new Date(),
    category: "Other",
    description: "",
    amount: undefined as unknown as number,
    currency: "USD",
    recurrence: null,
  });

  // Bug fix (separate amountInput string): the input element is displayed
  // from this raw string so the user's literal keystrokes (`.` or `,`)
  // are preserved while typing. Without this, every keystroke ran
  // through parseAmountInput and React's controlled <input> would
  // immediately re-render with the parsed NUMBER, erasing the trailing
  // `.` or `,` the user just pressed (so "10.5" turned into "105" and
  // dot/comma entry appeared broken). The numeric submission reads from
  // `amount` (re-parsed at submit time); `amountInput` is purely the
  // displayed buffer.
  const [amountInput, setAmountInput] = useState<string>("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Re-parse the raw string at submit time so the trailing separators
    // the user typed (`10.5`, `23,15`) resolve to the right number.
    const parsedAtSubmit = currencyService.parseAmountInput(amountInput);
    const absAmount = Math.abs(parsedAtSubmit);

    if (Number.isNaN(absAmount) || absAmount === 0) {
      errorToast(t("transactions.zeroAmountMsg"), 3000, "invalid-amount");
      return;
    }

    // Apply sign: expense → negative, income → positive
    const signedAmount = transactionType === "expense" ? -absAmount : absAmount;

    // Map "One-time" or empty value back to `null` so the backend stores
    // an absent recurrence on a non-recurring transaction.
    const recurrence: IncomeRecurrence | null =
      formData.recurrence && formData.recurrence !== ONE_TIME_LABEL
        ? (formData.recurrence as IncomeRecurrence)
        : null;

    onSubmit({
      id: transaction?.id ?? undefined,
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: signedAmount,
      recurrence,
    });
  };

  const isEditing = !!transaction;

  useEffect(() => {
    if (transaction) {
      const abs = Math.abs(transaction.amount);
      setFormData({
        id: transaction.id,
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        amount: abs,
        currency: transaction.currency,
        recurrence: transaction.recurrence ?? null,
      });
      // Seed the input buffer with a locale-neutral representation so
      // existing rows open with a sensible value and edits keep the
      // exact numeric magnitude.
      setAmountInput(String(abs));
      // Derive the toggle from the original amount sign
      setTransactionType(transaction.amount >= 0 ? "income" : "expense");
    }
  }, [transaction]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Income / Expense Toggle */}
      <div className="space-y-2">
        <Label>{t("transactions.type")}</Label>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            data-testid="type-expense"
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
            data-testid="type-income"
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

      <div className="space-y-2 grid">
        <Label htmlFor="category">{t("transactions.category")}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          {" "}
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
            // user's typing (including the `.` or `,` they just pressed)
            // is preserved character-for-character. Parsing happens once
            // at submit time in `handleSubmit`.
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
            }}
            className="pl-7"
            placeholder="0.00"
            required
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("transactions.amountHint")}
        </p>
      </div>

      {/* Phase 3 (T3.5): recurrence picker shown only for income rows.
          Expense rows store `null` (non-recurring by default). */}
      {transactionType === "income" && (
        <div className="space-y-2">
          <Label htmlFor="recurrence">{t("transactions.recurrence")}</Label>
          <select
            id="recurrence"
            name="recurrence"
            value={formData.recurrence ?? ONE_TIME_LABEL}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value={ONE_TIME_LABEL}>{t("transactions.oneTime")}</option>
            {INCOME_RECURRENCES.filter((r) => r !== ONE_TIME_LABEL).map((r) => (
              <option key={r} value={r}>
                {t(`recurrence.${r}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {isEditing ? t("common.update") : t("transactions.addTransaction")}
        </Button>
      </div>
    </form>
  );
}
