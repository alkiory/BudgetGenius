import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import {
  Transaction,
  TransactionPatch,
} from "@domain/dashboard/transactions/transaction.entity";
import { Modal } from "@presentation/components/modal/modal";
import { Pencil } from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { successToast, errorToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TransactionForm } from "./transaction-form";

interface EditTransactionButtonProps {
  transaction: Transaction;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  children?: React.ReactNode;
}

export function EditTransaction({
  transaction,
  variant = "ghost",
  children,
}: EditTransactionButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: updateTransaction } = useMutation({
    mutationKey: ["add-transaction"],
    mutationFn: HttpTransactionRepository.updateTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      successToast(data.message, 3000, "transaction-create");
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
      // A savings deposit's amount is part of the goal's progress.
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (error) => {
      errorToast(error.message, 3000, "transaction-create");
    },
  });

  const handleUpdateTransaction = (updatedTransaction: TransactionPatch) => {
    if (updatedTransaction.id === undefined) {
      errorToast(t("transactions.idRequired"), 3000, "transaction-update");
      return;
    }
    updateTransaction({
      dto: {
        ...updatedTransaction,
        amount: Number(updatedTransaction.amount),
      },
    });
    setIsOpen(false);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["recent-summary"] });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={variant}
        size="icon"
        className="h-8 w-8 p-0"
        data-testid="edit-transaction"
      >
        {children || <Pencil className="h-4 w-4" />}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("transactions.editTransaction")}
      >
        <TransactionForm
          transaction={transaction}
          onSubmit={handleUpdateTransaction}
          onCancel={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
}
