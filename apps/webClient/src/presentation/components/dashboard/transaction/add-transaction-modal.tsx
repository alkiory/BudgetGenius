import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { NewTransactionInput } from "@domain/dashboard/transactions/transaction.entity";
import { Modal } from "@presentation/components/modal/modal";
import { Button } from "@presentation/components/ui/button";
import { APP_PATHS } from "@presentation/utils/routes";
import { successToast, errorToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import AddTransactionForm from "./add-transaction";

export function AddTransactionModal({
  isHeader,
  trigger,
  triggerClassName,
}: {
  isHeader?: boolean;
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { mutate: addTransaction } = useMutation({
    mutationKey: ["add-transaction"],
    mutationFn: HttpTransactionRepository.createTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-create");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
      setIsOpen(false);

      const path = location.pathname.replace(/\/$/, "");
      const stayOnCurrentView =
        path === APP_PATHS.dashboard || path === APP_PATHS.transactions;
      if (!stayOnCurrentView) {
        navigate(APP_PATHS.dashboard, { replace: true });
      }
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-create");
    },
  });

  const handleAddTransaction = (transaction: NewTransactionInput) => {
    if (transaction.amount === 0) {
      errorToast("Amount cannot be 0", 3000, "invalid-amount");
      return;
    }

    addTransaction({
      dto: {
        ...transaction,
      },
    });
  };

  const modalTitle =
    !trigger && !isHeader ? "" : t("transactions.addNewTransaction");

  return (
    <>
      {trigger ? (
        isValidElement(trigger) ? (
          cloneElement(
            trigger as ReactElement<{
              onClick?: (...args: unknown[]) => void;
            }>,
            {
              onClick: (...args: unknown[]) => {
                const existing = (
                  trigger.props as {
                    onClick?: (...args: unknown[]) => void;
                  }
                ).onClick;
                existing?.(...args);
                setIsOpen(true);
              },
            },
          )
        ) : (
          <Button variant="primary" onClick={() => setIsOpen(true)}>
            {trigger}
          </Button>
        )
      ) : !isHeader ? (
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          size="lg"
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-base font-semibold shadow-md hover:shadow-lg transition-all${triggerClassName ? ` ${triggerClassName}` : ""
            }`}
        >
          <Plus className="h-5 w-5" />
          {t("transactions.addTransaction")}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          size="icon"
          className="rounded-full bg-purple-50 p-1 text-purple-600 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:bg-slate-800 dark:text-purple-400 dark:hover:text-purple-300"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={modalTitle}
      >
        <AddTransactionForm
          onSubmit={handleAddTransaction}
          onCancel={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
}
