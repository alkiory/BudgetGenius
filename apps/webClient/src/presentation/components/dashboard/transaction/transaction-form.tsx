import { useTranslation } from 'react-i18next';
import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Label } from "@presentation/components/ui/label"
import { TRANSACTION_CATEGORIES, Transaction } from "@domain/dashboard/transactions/transaction.entity"
import { errorToast } from "@presentation/utils/toast"

interface TransactionFormProps {
  transaction?: Transaction
  onSubmit: (transaction: Partial<Transaction>) => void
  onCancel: () => void
}

export function TransactionForm({ transaction, onSubmit, onCancel }: TransactionFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Transaction>({
    id: 0,
    date: new Date(),
    category: "",
    description: "",
    amount: 0,
    status: "Pending",
    currency: "USD",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.amount === 0) {
      errorToast(t('transactions.zeroAmountMsg'), 3000, "invalid-amount")
      return
    }

    onSubmit({
      id: transaction?.id ?? undefined,
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: Number(formData.amount),
      status: formData.status,
    })
  }

  const isEditing = !!transaction

  useEffect(() => {
    if (transaction) {
      setFormData({
        id: transaction.id,
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        amount: transaction.amount,
        status: transaction.status,
        currency: transaction.currency,
      })
    }
  }, [transaction])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 grid">
        <Label htmlFor="category">{t('transactions.category')}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >            <option value="" disabled>
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
            placeholder="0.00"
            required
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('transactions.amountHint')}
        </p>
      </div>

      {isEditing && (
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
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{isEditing ? t('common.update') : t('transactions.addTransaction')}</Button>
      </div>
    </form>
  )
}
