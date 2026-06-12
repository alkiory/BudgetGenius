import { useTranslation } from 'react-i18next';
import { TRANSACTION_CATEGORIES, Transaction } from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { errorToast } from "@presentation/utils/toast";
import { useState } from "react";

interface AddTransactionFormProps {
  onSubmit: (transaction: Omit<Transaction, "id">) => void
  onCancel: () => void
}

export default function AddTransactionForm({ onSubmit, onCancel }: AddTransactionFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Omit<Transaction, "id">>({
    date: new Date(),
    category: "",
    description: "",
    amount: 0,
    currency: "USD",
    status: "Pending",
  })

  const CurrencySelector = () => (
    <div className="space-y-2">
      <Label htmlFor="currency">{t('transactions.currency')}</Label>
      <select
        id="currency"
        name="currency"
        value={formData.currency}
        onChange={handleChange}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        required
      >
        {currencyService.getAvailableCurrencies().map(currency => (
          <option key={currency} value={currency}>
            {currency} ({currencyService.getSymbol(currency)})
          </option>
        ))}
      </select>
    </div>
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) : value
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currencyService.validateAmount(formData.amount, formData.currency as Currency)) {
      errorToast(t('transactions.invalidCurrencyAmount'), 3000, "invalid-amount");
      return;
    }

    if (formData.amount === 0) {
      errorToast(t('transactions.zeroAmountMsg'), 3000, "invalid-amount")
      return
    }

    onSubmit({
      ...formData,
      amount: currencyService.normalizeAmount(formData.amount, formData.currency as Currency),
      date: new Date(),
    })
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">{t('transactions.category')}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          <option value="" disabled>
            {t('transactions.selectCategory')}
          </option>
          {TRANSACTION_CATEGORIES.filter(category => category !== "All" && category !== "Todos").map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('transactions.description')}</Label>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t('transactions.enterDescription')}
        />
      </div>

      <CurrencySelector />

      <div className="space-y-2">
        <Label htmlFor="amount">{t('transactions.amount')}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={handleChange}
            className="pl-7"
            placeholder={t('common.amountPlaceholder')}
            required
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('transactions.amountHint')}
        </p>
      </div>

      <div className="space-y-2 grid">
        <Label htmlFor="status">{t('transactions.status')}</Label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          <option value="Pending">{t('transactions.statusPending')}</option>
          <option value="Completed">{t('transactions.statusCompleted')}</option>
          <option value="Cancelled">{t('transactions.statusCancelled')}</option>
        </select>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('transactions.addTransaction')}</Button>
      </div>
    </form>
  )
}