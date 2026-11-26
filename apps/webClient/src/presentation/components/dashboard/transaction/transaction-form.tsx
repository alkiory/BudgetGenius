import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { RootState } from "@adapters/store/rootStore";
import {
  DEFAULT_TRANSACTION_CATEGORIES,
  INCOME_RECURRENCES,
  IncomeRecurrence,
  Transaction,
  TransactionPatch,
} from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Select } from "@presentation/components/ui/select";
import { Currency, currencyService } from "@presentation/utils/currencyService";
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

const ONE_TIME_LABEL = "One-time";

function toDateInputValue(value: Date | string): string {
  if (typeof value === "string") {
    const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly) return dateOnly;
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionForm({
  transaction,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "EUR") as Currency;

  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense",
  );
  const [formData, setFormData] = useState<Transaction>({
    id: 0,
    date: toDateInputValue(new Date()),
    category: "Other",
    description: "",
    amount: undefined as unknown as number,
    recurrence: null,
  });

  const amountInput = useDecimalInput({
    initial: undefined,
    currency: targetCurrency,
  });

  const { setText: setAmountText } = amountInput;
  const seedAmountBuffer = useCallback(
    (raw: number | undefined) => {
      if (raw === undefined) {
        setAmountText("");
        return;
      }
      // Round before seeding: legacy rows can hold floats left over from
      // the old conversion logic (e.g. `62.787499999999994`). The editor
      // should open with `62.79`, never the binary residue.
      setAmountText(currencyService.formatAmountInput(raw, targetCurrency));
    },
    [setAmountText, targetCurrency],
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
    const amountIsUnchanged =
      absAmount === Math.abs(transaction?.amount ?? NaN);
    if (
      !amountIsUnchanged &&
      !currencyService.validateAmount(absAmount, targetCurrency)
    ) {
      errorToast(
        t("transactions.invalidCurrencyAmount"),
        3000,
        "invalid-amount",
      );
      return;
    }

    // Round to the currency's precision so edits never re-persist a raw
    // floating-point value (typing more decimals than the currency allows
    // is still rejected by `validateAmount` above).
    const roundedAmount = currencyService.roundAmount(
      absAmount,
      targetCurrency,
    );
    const signedAmount =
      transactionType === "expense" ? -roundedAmount : roundedAmount;

    // Map "One-time" or empty value back to `null` so the backend stores
    // an absent recurrence on a non-recurring transaction.
    const recurrence: IncomeRecurrence | null =
      formData.recurrence && formData.recurrence !== ONE_TIME_LABEL
        ? (formData.recurrence as IncomeRecurrence)
        : null;

    onSubmit({
      id: transaction?.id ?? undefined,
      date: new Date(`${formData.date}T00:00:00.000Z`),
      currency: targetCurrency,
      category: formData.category,
      description: formData.description,
      amount: signedAmount,
      recurrence,
    });
  };

  const isEditing = !!transaction;

  useEffect(() => {
    if (!transaction) return;

    const abs = Math.abs(transaction.amount);
    setFormData({
      id: transaction.id,
      date: toDateInputValue(transaction.date),
      category: transaction.category,
      description: transaction.description,
      amount: currencyService.roundAmount(abs, targetCurrency),
      recurrence: transaction.recurrence ?? null,
    });
    // Amounts are persisted without currency conversion, so seed the
    // editor with the stored magnitude, rounded to two decimals. Only
    // reset when switching to a different transaction, not when form
    // state changes.
    seedAmountBuffer(abs);
    setTransactionType(transaction.amount >= 0 ? "income" : "expense");
  }, [transaction, seedAmountBuffer, targetCurrency]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Income / Expense Toggle */}
      <div className="space-y-2">
        <Label>{t("transactions.type")}</Label>
        <div className="flex gap-1 rounded-xl border border-slate-200/80 bg-slate-100/60 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          <button
            type="button"
            data-testid="type-expense"
            onClick={() => setTransactionType("expense")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              transactionType === "expense"
                ? "bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-400/30 dark:bg-rose-400/15 dark:text-rose-300"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
            }`}
          >
            {t("transactions.expense")}
          </button>
          <button
            type="button"
            data-testid="type-income"
            onClick={() => setTransactionType("income")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              transactionType === "income"
                ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-300"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
            }`}
          >
            {t("transactions.income")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{t("transactions.category")}</Label>
        <Select
          id="category"
          name="category"
          value={formData.category}
          onChange={(value) =>
            setFormData((previous) => ({ ...previous, category: value }))
          }
          options={[
            { value: "Other", label: t("categories.other") },
            // A row created before the list was shortened keeps its own
            // category selectable instead of silently becoming "Other".
            ...(formData.category &&
            !DEFAULT_TRANSACTION_CATEGORIES.includes(formData.category)
              ? [
                  {
                    value: formData.category,
                    label: t(`categories.${formData.category.toLowerCase()}`, {
                      defaultValue: formData.category,
                    }),
                  },
                ]
              : []),
            ...DEFAULT_TRANSACTION_CATEGORIES.filter(
              (category) => category !== "Other",
            ).map((category) => ({
              value: category,
              label: t(`categories.${category.toLowerCase()}`),
            })),
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">{t("transactions.date")}</Label>
        <Input
          id="date"
          name="date"
          type="date"
          value={toDateInputValue(formData.date)}
          onChange={handleChange}
          required
        />
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
              amountInput.precision === 0 ? 1 : 1 / 10 ** amountInput.precision
            }
            value={amountInput.text}
            onChange={(e) => {
              amountInput.setText(e.target.value);
            }}
            aria-label={t("transactions.amount")}
            aria-invalid={amountInput.text !== "" && !amountInput.isValid()}
            className="pl-7"
            placeholder={amountInput.livePreview() || "0.00"}
            required
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("transactions.amountHint")}
        </p>
      </div>

      {transactionType === "income" && (
        <div className="space-y-2">
          <Label htmlFor="recurrence">{t("transactions.recurrence")}</Label>
          <Select
            id="recurrence"
            name="recurrence"
            value={formData.recurrence ?? ONE_TIME_LABEL}
            onChange={(value) =>
              setFormData((previous) => ({
                ...previous,
                recurrence: value as IncomeRecurrence,
              }))
            }
            options={[
              { value: ONE_TIME_LABEL, label: t("transactions.oneTime") },
              ...INCOME_RECURRENCES.filter(
                (recurrence) => recurrence !== ONE_TIME_LABEL,
              ).map((recurrence) => ({
                value: recurrence,
                label: t(`recurrence.${recurrence}`),
              })),
            ]}
          />
        </div>
      )}

      {/* Pinned to the bottom of the modal's scroll area so Cancel /
          Update stay reachable even when the form (including the
          Recurrence field) is taller than a short viewport. */}
      <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/95 px-1 py-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
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
