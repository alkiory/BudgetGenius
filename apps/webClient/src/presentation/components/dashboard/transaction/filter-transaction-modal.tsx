import { useTranslation } from 'react-i18next';
import { TRANSACTION_CATEGORIES, TRANSACTION_STATUSES } from "@domain/dashboard/transactions/transaction.entity";
import { Modal } from "@presentation/components/modal/modal";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { warningToast } from "@presentation/utils/toast";
import { useState } from "react";

// Tipos más estrictos
type Category = typeof TRANSACTION_CATEGORIES[number];
type Status = typeof TRANSACTION_STATUSES[number];

export interface FilterCriteria {
  dateFrom: string;
  dateTo: string;
  categories: Category[];
  minAmount: number | null;
  maxAmount: number | null;
  statuses: Status[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterCriteria) => void;
  currentFilters: FilterCriteria;
}

// Helper para manejar selección de opciones
const handleOptionSelection = <T extends string>(
  currentOptions: T[],
  selectedOption: T,
  allOption: T
): T[] => {
  if (selectedOption === allOption) {
    return currentOptions.includes(allOption) ? [] : [allOption];
  }

  return currentOptions.includes(selectedOption)
    ? currentOptions.filter(option => option !== selectedOption)
    : [...currentOptions.filter(option => option !== allOption), selectedOption];
};

export function FilterModal({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters
}: FilterModalProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = value === "" ? null : parseFloat(value);
    setFilters(prev => ({ ...prev, [name]: numericValue }));
  };

  const handleCategoryChange = (category: Category) => {
    setFilters(prev => ({
      ...prev,
      categories: handleOptionSelection(prev.categories, category, "All")
    }));
  };

  const handleStatusChange = (status: Status) => {
    setFilters(prev => ({
      ...prev,
      statuses: handleOptionSelection(prev.statuses, status, "All")
    }));
  };

  const validateFilters = (): boolean => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      warningToast(t('common.warningDateFromBeforeTo'), 3000, "from-date");
      return false;
    }

    if (filters.minAmount !== null &&
      filters.maxAmount !== null &&
      filters.minAmount > filters.maxAmount) {
      warningToast(t('common.warningMinAmountLessThanMax'), 3000, "amount-range");
      return false;
    }

    return true;
  };

  const handleApply = () => {
    if (!validateFilters()) return;

    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: FilterCriteria = {
      dateFrom: "",
      dateTo: "",
      categories: ["All"],
      minAmount: null,
      maxAmount: null,
      statuses: ["All"],
    };
    setFilters(resetFilters);
    onApplyFilters(resetFilters);
    onClose();
  };

  // Componente reutilizable para botones de opción
  const OptionButton = <T extends string>({
    option,
    selectedOptions,
    onClick,
    label
  }: {
    option: T;
    selectedOptions: T[];
    onClick: (option: T) => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => onClick(option)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${selectedOptions.includes(option)
        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
        : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        }`}
      aria-pressed={selectedOptions.includes(option)}
      aria-label={`${t('common.filterBy')} ${label}`}
    >
      {label}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.applyFilters')}>
      <div className="space-y-4">
        {/* Sección de fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">{t('common.fromDate')}</Label>
            <Input
              id="dateFrom"
              name="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={handleChange}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">{t('common.toDate')}</Label>
            <Input
              id="dateTo"
              name="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={handleChange}
              className="w-full"
            />
          </div>
        </div>

        {/* Sección de categorías */}
        <div className="space-y-2">
          <Label>{t('transactions.category')}</Label>
          <div className="flex flex-wrap gap-2">
            {TRANSACTION_CATEGORIES.map(category => (
              <OptionButton
                key={category}
                option={category}
                selectedOptions={filters.categories}
                onClick={handleCategoryChange}
                label={t(`categories.${category.toLowerCase()}`)}
              />
            ))}
          </div>
        </div>

        {/* Sección de montos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minAmount">{t('common.minAmount')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="minAmount"
                name="minAmount"
                type="number"
                step="0.01"
                value={filters.minAmount ?? ""}
                onChange={handleAmountChange}
                className="pl-7"
                placeholder={t('common.amountPlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxAmount">{t('common.maxAmount')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="maxAmount"
                name="maxAmount"
                type="number"
                step="0.01"
                value={filters.maxAmount ?? ""}
                onChange={handleAmountChange}
                className="pl-7"
                placeholder={t('common.amountPlaceholder')}
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Sección de estados */}
        <div className="space-y-2">
          <Label>{t('transactions.status')}</Label>
          <div className="flex flex-wrap gap-2">
            {TRANSACTION_STATUSES.map(status => (
              <OptionButton
                key={status}
                option={status}
                selectedOptions={filters.statuses}
                onClick={handleStatusChange}
                label={status === 'All' ? t('statuses.all') : t(`transactions.status${status}`)}
              />
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('common.reset')}
          </Button>
          <Button type="button" onClick={handleApply}>
            {t('common.applyFilters')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}