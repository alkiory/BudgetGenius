import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { useFetchReconciliation } from "@adapters/query/dashboard";
import { useUserSettings } from "@adapters/hooks/useUserSettings";
import { Modal } from "@presentation/components/modal/modal";
import { Button } from "@presentation/components/ui/button";
import { Select } from "@presentation/components/ui/select";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface BudgetReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Historical reconciliation queue. The API only returns expenses that are
 * inside a spending window and whose text category matches none of that
 * budget's categories, so every row needs an explicit human decision. The
 * select is intentionally empty by default: no guessed attribution.
 */
export function BudgetReconciliationModal({
  isOpen,
  onClose,
}: BudgetReconciliationModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useUserSettings();
  const locale = settings?.locale || "es-ES";
  const currency = (settings?.currency || "EUR") as Currency;

  const { data, isLoading } = useFetchReconciliation(isOpen);
  // Empty selection is the default (`?? ""` at the select), so rows do not
  // need a synchronisation effect when the queue refetches.
  const [selected, setSelected] = useState<Record<number, string>>({});

  const { mutate: reconcile, isPending, variables } = useMutation({
    mutationFn: ({
      transactionId,
      budgetCategoryId,
    }: {
      transactionId: number;
      budgetCategoryId: number;
    }) => HttpBudgetRepository.reconcileExpense(transactionId, budgetCategoryId),
    onSuccess: () => {
      successToast(t("budgets.reconcileSuccess"), 3000, "budget-reconcile");
      queryClient.invalidateQueries({ queryKey: ["budget-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: () => {
      errorToast(t("budgets.reconcileError"), 4000, "budget-reconcile");
    },
  });

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("budgets.reconcileTitle")}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("budgets.reconcileDescription")}
        </p>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {t("common.loading")}
          </p>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-white/10">
            <Link2 className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("budgets.reconcileEmpty")}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("budgets.reconcilePending", { total: data.total })}
            </p>
            <ul className="space-y-3">
              {data.items.map((item) => {
                const isRowPending =
                  isPending && variables?.transactionId === item.id;
                const amount = currencyService.formatCurrency(
                  Math.abs(item.amount),
                  currency,
                  false,
                ).formatted;

                return (
                  <li
                    key={item.id}
                    className="space-y-3 rounded-lg border border-slate-200/90 bg-white/70 p-3 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {item.description}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(item.date)} · {item.category}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("budgets.reconcileBudget")}:{" "}
                          <span className="font-medium">{item.budgetName}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {amount}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={t("budgets.reconcileChooseCategory")}
                        className="min-w-0 flex-1"
                        value={selected[item.id] ?? ""}
                        placeholder={t("budgets.reconcileChooseCategory")}
                        onChange={(value) =>
                          setSelected((previous) => ({
                            ...previous,
                            [item.id]: value,
                          }))
                        }
                        options={[
                          {
                            value: "",
                            label: t("budgets.reconcileChooseCategory"),
                          },
                          ...item.candidates.map((candidate) => ({
                            value: String(candidate.id),
                            label: candidate.name,
                          })),
                        ]}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selected[item.id] || isRowPending}
                        onClick={() =>
                          reconcile({
                            transactionId: item.id,
                            budgetCategoryId: Number(selected[item.id]),
                          })
                        }
                      >
                        {isRowPending
                          ? t("common.saving")
                          : t("budgets.reconcileAssign")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
