import {
  INCOME_RECURRENCES,
  IncomeRecurrence,
  TRANSACTION_CATEGORIES,
} from "@domain/dashboard/transactions/transaction.entity";
import { Modal } from "@presentation/components/modal/modal";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { currencyService } from "@presentation/utils/currencyService";
import { warningToast } from "@presentation/utils/toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// Tipos más estrictos
type Category = (typeof TRANSACTION_CATEGORIES)[number];

// Phase 3 (T3.6): "All" + the IncomeRecurrence union. `RecurrenceFilter`
// is optional on FilterCriteria so existing transaction-page callers
// (which never set recurrences) continue to work — the chip row is
// rendered only when the parent provides a non-empty recurrence list.
export type RecurrenceFilter = "All" | IncomeRecurrence;

export interface FilterCriteria {
  dateFrom: string;
  dateTo: string;
  categories: Category[];
  minAmount: number | null;
  maxAmount: number | null;
  recurrences?: RecurrenceFilter[];
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
  allOption: T,
): T[] => {
  if (selectedOption === allOption) {
    return currentOptions.includes(allOption) ? [] : [allOption];
  }

  return currentOptions.includes(selectedOption)
    ? currentOptions.filter((option) => option !== selectedOption)
    : [
        ...currentOptions.filter((option) => option !== allOption),
        selectedOption,
      ];
};

export function FilterModal({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters,
}: FilterModalProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (category: Category) => {
    setFilters((prev) => ({
      ...prev,
      categories: handleOptionSelection(prev.categories, category, "All"),
    }));
  };

  // Parse the local amount-input strings on demand so validation sees
  // what the user actually typed rather than the (now-stale) numeric
  // values stored in `filters` from the moment the modal mounted. The
  // amount inputs no longer mutate `filters.minAmount` / `maxAmount`
  // because they're driven by raw string buffers — if we read
  // `filters.minAmount` here, the cross-amount check would always see
  // the last-applied values instead of the freshly typed ones,
  // silently letting min > max through.
  // Single parse into locals; both validation and Apply reuse the
  // resulting numbers so we don't trip the same expression twice.
  const parseAmountBuffer = (raw: string): number | null => {
    if (raw === "") return null;
    const parsed = currencyService.parseAmountInput(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const validateFilters = (
    parsedMin: number | null,
    parsedMax: number | null,
  ): boolean => {
    if (
      filters.dateFrom &&
      filters.dateTo &&
      filters.dateFrom > filters.dateTo
    ) {
      warningToast(t("common.warningDateFromBeforeTo"), 3000, "from-date");
      return false;
    }

    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      warningToast(
        t("common.warningMinAmountLessThanMax"),
        3000,
        "amount-range",
      );
      return false;
    }

    return true;
  };

  const handleApply = () => {
    // Parse once; the same parsed values drive validation AND submission.
    const parsedMin = parseAmountBuffer(minAmountInput);
    const parsedMax = parseAmountBuffer(maxAmountInput);

    if (!validateFilters(parsedMin, parsedMax)) return;

    onApplyFilters({
      ...filters,
      minAmount: parsedMin,
      maxAmount: parsedMax,
    });
    onClose();
  };

  const handleReset = () => {
    const resetFilters: FilterCriteria = {
      ...filters,
      dateFrom: "",
      dateTo: "",
      categories: ["All"],
      minAmount: null,
      maxAmount: null,
      recurrences: ["All"],
    };
    setFilters(resetFilters);
    setMinAmountInput("");
    setMaxAmountInput("");
    onApplyFilters(resetFilters);
    onClose();
  };

  // Bug fix (raw string buffers for amount inputs): the min/max amount
  // inputs previously stored parsed numbers in filter state. That meant
  // every dot/comma the user typed was erased on the next render because
  // parseAmountInput returns the integer base. Mirrors the same fix as
  // the transaction forms — keeps a raw string for the displayed buffer
  // and parses on Apply (which is when validation runs anyway).
  const [minAmountInput, setMinAmountInput] = useState<string>(
    currentFilters.minAmount !== null && currentFilters.minAmount !== undefined
      ? String(currentFilters.minAmount)
      : "",
  );
  const [maxAmountInput, setMaxAmountInput] = useState<string>(
    currentFilters.maxAmount !== null && currentFilters.maxAmount !== undefined
      ? String(currentFilters.maxAmount)
      : "",
  );

  const handleMinAmountInputChange = (value: string) => {
    setMinAmountInput(value);
  };

  const handleMaxAmountInputChange = (value: string) => {
    setMaxAmountInput(value);
  };

  // Phase 3 (T3.6): recurrence selection helper. Mirrors category logic.
  const handleRecurrenceChange = (recurrence: RecurrenceFilter) => {
    setFilters((prev) => ({
      ...prev,
      recurrences: handleOptionSelection(
        prev.recurrences ?? ["All"],
        recurrence,
        "All",
      ),
    }));
  };

  // Componente reutilizable para botones de opción
  const OptionButton = <T extends string>({
    option,
    selectedOptions,
    onClick,
    label,
  }: {
    option: T;
    selectedOptions: T[];
    onClick: (option: T) => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => onClick(option)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        selectedOptions.includes(option)
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
          : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
      }`}
      aria-pressed={selectedOptions.includes(option)}
      aria-label={`${t("common.filterBy")} ${label}`}
    >
      {label}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("common.applyFilters")}>
      <div className="space-y-4">
        {/* Sección de fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">{t("common.fromDate")}</Label>
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
            <Label htmlFor="dateTo">{t("common.toDate")}</Label>
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
          <Label>{t("transactions.category")}</Label>
          <div className="flex flex-wrap gap-2">
            {TRANSACTION_CATEGORIES.map((category) => (
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

        {/* Phase 3 (T3.6): recurrence chip row. Renders only when the
            parent supplied a recurring list. transactionPage passes
            `["All"]` (default) so the row renders without affecting
            non-income filtering; incomePage passes `["All"]` plus its
            own recurrences. */}
        {filters.recurrences !== undefined && (
          <div className="space-y-2">
            <Label>{t("transactions.recurrence")}</Label>
            <div className="flex flex-wrap gap-2">
              <OptionButton
                option="All"
                selectedOptions={filters.recurrences ?? ["All"]}
                onClick={handleRecurrenceChange}
                label={t("common.all")}
              />
              {INCOME_RECURRENCES.map((recurrence) => (
                <OptionButton
                  key={recurrence}
                  option={recurrence}
                  selectedOptions={filters.recurrences ?? ["All"]}
                  onClick={handleRecurrenceChange}
                  label={t(`recurrence.${recurrence}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sección de montos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minAmount">{t("common.minAmount")}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <Input
                id="minAmount"
                name="minAmount"
                type="text"
                inputMode="decimal"
                value={minAmountInput}
                onChange={(e) => handleMinAmountInputChange(e.target.value)}
                className="pl-7"
                placeholder={t("common.amountPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxAmount">{t("common.maxAmount")}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <Input
                id="maxAmount"
                name="maxAmount"
                type="text"
                inputMode="decimal"
                value={maxAmountInput}
                onChange={(e) => handleMaxAmountInputChange(e.target.value)}
                className="pl-7"
                placeholder={t("common.amountPlaceholder")}
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            {t("common.reset")}
          </Button>
          <Button type="button" onClick={handleApply}>
            {t("common.applyFilters")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
