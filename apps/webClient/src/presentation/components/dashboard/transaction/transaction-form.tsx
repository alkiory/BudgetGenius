import { RootState } from "@adapters/store/rootStore";
import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
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
import type { Currency } from "@presentation/utils/currencyService";
import { errorToast } from "@presentation/utils/toast";
import { useCallback, useState, useEffect } from "react";
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

  // Wave 2 [T2.2]: locale-aware decimal input backed by
  // `useDecimalInput`. Replaces the previous ad-hoc `amountInput` raw
  // string buffer plus the monolithic `parseAmountInput` call. The
  // hook owns:
  //   - the `<input type="text" inputMode="decimal">` value
  //   - the parse-at-submit gate (no per-keystroke numeric coercion)
  //   - the currency-aware `step` and `placeholder` for the input
  //   - the locale-aware currency symbol prefix
  const amountInput = useDecimalInput({
    initial: undefined,
    currency: targetCurrency,
  });

  const seedAmountBuffer = useCallback(
    (raw: number | undefined) => {
      if (raw === undefined) {
        amountInput.setText("");
        return;
      }
      const abs = Math.abs(raw);
      // Round to the currency's precision so the buffer opens with the
      // exact value the parent will see on submit (avoids a wondering
      // "the form showed 10.1 but the value was 10.100000000000001"
      // from a JSON numeric round-trip).
      const precision = amountInput.precision;
      const rounded = Number(abs.toFixed(precision));
      amountInput.setText(Number.isFinite(rounded) ? String(rounded) : "");
    },
    [amountInput],
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse at submit time — the hook's invariant is that intermediate
    // typing states (`"1."`, `"23,15"`) round-trip to the right number
    // because the raw buffer is preserved verbatim.
    const parsedAtSubmit = amountInput.parseNumber();
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
      seedAmountBuffer(transaction.amount);
      // Derive the toggle from the original amount sign
      setTransactionType(transaction.amount >= 0 ? "income" : "expense");
    }
  }, [transaction, seedAmountBuffer]);

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
            {amountInput.symbol}
          </span>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            // Controlled by `useDecimalInput`'s raw string buffer so the
            // user's typing (including the `.` or `,` they just pressed)
            // is preserved character-for-character. Parsing happens once
            // at submit time in `handleSubmit`.
            step={
              amountInput.precision === 0
                ? 1
                : 1 / 10 ** amountInput.precision
            }
            value={amountInput.text}
            onChange={(e) => {
              amountInput.setText(e.target.value);
            }}
            aria-label={t("transactions.amount")}
            aria-invalid={
              amountInput.text !== "" && !amountInput.isValid()
            }
            className="pl-7"
            placeholder={amountInput.livePreview() || "0.00"}
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
