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
import { useState, useEffect } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (transaction: Partial<Transaction>) => void;
  onCancel: () => void;
}

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
    status: "Pending",
    currency: "USD",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const absAmount = Math.abs(Number(formData.amount));

    if (Number.isNaN(absAmount) || absAmount === 0) {
      errorToast(t("transactions.zeroAmountMsg"), 3000, "invalid-amount");
      return;
    }

    // Apply sign: expense → negative, income → positive
    const signedAmount = transactionType === "expense" ? -absAmount : absAmount;

    onSubmit({
      id: transaction?.id ?? undefined,
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: signedAmount,
      status: formData.status,
    });
  };

  const isEditing = !!transaction;

  useEffect(() => {
    if (transaction) {
      setFormData({
        id: transaction.id,
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        amount: Math.abs(transaction.amount),
        status: transaction.status,
        currency: transaction.currency,
      });
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
            type="number"
            step="0.01"
            min="0"
            value={formData.amount ?? ""}
            onChange={(e) => {
              const { value } = e.target;
              setFormData((prev) => ({
                ...prev,
                amount:
                  value === ""
                    ? (undefined as unknown as number)
                    : Math.abs(parseFloat(value) || 0),
              }));
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

      {isEditing && (
        <div className="space-y-2 grid">
          <Label htmlFor="status">{t("transactions.status")}</Label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            required
          >
            <option value="Pending">{t("transactions.statusPending")}</option>
            <option value="Completed">
              {t("transactions.statusCompleted")}
            </option>
            <option value="Cancelled">
              {t("transactions.statusCancelled")}
            </option>
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
