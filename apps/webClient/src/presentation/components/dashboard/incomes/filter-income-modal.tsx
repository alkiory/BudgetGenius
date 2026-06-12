import { useTranslation } from 'react-i18next';
import { useState } from "react"
import { warningToast } from "@presentation/utils/toast"
import { Modal } from "@presentation/components/modal/modal"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Label } from "@presentation/components/ui/label"
import { Category, INCOME_CATEGORIES, INCOME_RECURRENCES, Recurrence } from "@domain/dashboard/incomes/income.entity"

export interface FilterCriteria {
  dateFrom: string
  dateTo: string
  categories: Category[]
  minAmount: number | null
  maxAmount: number | null
  recurrences: Recurrence[]
}

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters: (filters: FilterCriteria) => void
  currentFilters: FilterCriteria
}

function toggleOption<T extends string>(
  current: T[],
  option: T,
  allOption: T
): T[] {
  if (option === allOption) {
    // if “All” clicked, either select only All or clear all
    return current.includes(allOption) ? [] : [allOption]
  }
  // toggle individual option; always remove “All” when picking specifics
  const withoutAll = current.filter(o => o !== allOption)
  return withoutAll.includes(option)
    ? withoutAll.filter(o => o !== option)
    : [...withoutAll, option]
}

export function FilterModal({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters,
}: FilterModalProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters)

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFilters(f => ({ ...f, [name]: value }))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFilters(f => ({ ...f, [name]: value === "" ? null : parseFloat(value) }))
  }

  const handleCategoryClick = (cat: Category) => {
    setFilters(f => ({
      ...f,
      categories: toggleOption(f.categories, cat, "All"),
    }))
  }

  const handleRecurrenceClick = (r: Recurrence) => {
    setFilters(f => ({
      ...f,
      recurrences: toggleOption(f.recurrences, r, "All"),
    }))
  }

  const validate = () => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      warningToast(t('common.warningDateFromBeforeTo'), 3000, "date-range")
      return false
    }
    if (
      filters.minAmount != null &&
      filters.maxAmount != null &&
      filters.minAmount > filters.maxAmount
    ) {
      warningToast(t('common.warningMinAmountLessThanMax'), 3000, "amount-range")
      return false
    }
    return true
  }

  const onApply = () => {
    if (!validate()) return
    onApplyFilters(filters)
    onClose()
  }

  const onReset = () => {
    const reset: FilterCriteria = {
      dateFrom: "",
      dateTo: "",
      categories: ["All"],
      minAmount: null,
      maxAmount: null,
      recurrences: ["All"],
    }
    setFilters(reset)
    onApplyFilters(reset)
    onClose()
  }

  const tCategory = (cat: string) => t(`incomeCategories.${cat.toLowerCase()}`);
  const tRecurrence = (r: string) => r === 'All'
    ? t('income.recurrenceAll')
    : r === 'One-time' ? t('income.recurrenceOneTime')
    : r === 'Bi-weekly' ? t('income.recurrenceBiWeekly')
    : t(`income.recurrence${r.charAt(0).toUpperCase() + r.slice(1).toLowerCase()}`);

  const OptionButton = <T extends string>({
    option,
    selected,
    onClick,
    label,
  }: {
    option: T
    selected: T[]
    onClick: (o: T) => void
    label: string
  }) => (
    <button
      type="button"
      onClick={() => onClick(option)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${selected.includes(option)
        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
        : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        }`}
    >
      {label}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('income.title') + ' (' + t('common.filter').toLowerCase() + ')'}>
      <div className="space-y-6">
        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateFrom">{t('common.fromDate')}</Label>
            <Input
              id="dateFrom"
              name="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={handleDateChange}
            />
          </div>
          <div>
            <Label htmlFor="dateTo">{t('common.toDate')}</Label>
            <Input
              id="dateTo"
              name="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={handleDateChange}
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <Label>{t('transactions.category')}</Label>
          <div className="flex flex-wrap gap-2">
            {INCOME_CATEGORIES.map(cat => (
              <OptionButton
                key={cat}
                option={cat}
                selected={filters.categories}
                onClick={handleCategoryClick}
                label={tCategory(cat)}
              />
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minAmount">{t('common.minAmount')}</Label>
            <Input
              id="minAmount"
              name="minAmount"
              type="number"
              step="0.01"
              value={filters.minAmount ?? ""}
              onChange={handleAmountChange}
              placeholder={t('common.amountPlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="maxAmount">{t('common.maxAmount')}</Label>
            <Input
              id="maxAmount"
              name="maxAmount"
              type="number"
              step="0.01"
              value={filters.maxAmount ?? ""}
              onChange={handleAmountChange}
              placeholder={t('common.amountPlaceholder')}
            />
          </div>
        </div>

        {/* Recurrence */}
        <div>
          <Label>{t('income.recurrence')}</Label>
          <div className="flex flex-wrap gap-2">
            {INCOME_RECURRENCES.map(r => (
              <OptionButton
                key={r}
                option={r}
                selected={filters.recurrences}
                onClick={handleRecurrenceClick}
                label={tRecurrence(r)}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onReset}>
            {t('common.reset')}
          </Button>
          <Button onClick={onApply}>{t('common.apply')}</Button>
        </div>
      </div>
    </Modal>
  )
}
