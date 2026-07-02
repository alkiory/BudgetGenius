import { clearAuthAndStateForLogout } from "@adapters/auth/clearAuthAndStateForLogout";
import { Button } from "@presentation/components/ui/button";
import { RoutePaths } from "@presentation/utils/routes";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { Modal } from "./modal";

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionExpiredModal({
  isOpen,
  onClose,
}: SessionExpiredModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // v1.7.2 — added for the centralised logout state-reset so this
  // modal's `handleLoginAgain` path no longer leaks React Query cache
  // / settings slice / localStorage tokens to the next mount. See
  // knowledge.md §6.8.5.
  const queryClient = useQueryClient();

  const handleLoginAgain = () => {
    clearAuthAndStateForLogout(dispatch, queryClient);
    // Soft in-app navigation: the user clicked "Sign in" from the
    // session-expired modal — same UX semantics as the sidebar's
    // logout button. Hard reload is reserved for the destructive
    // account-delete path in `account-settings.tsx`.
    navigate(`${RoutePaths.Auth}/${RoutePaths.Login}`, { replace: true });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("errors.sessionExpiredTitle")}
    >
      <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t("errors.sessionExpiredDescription")}
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleLoginAgain}>{t("auth.signIn")}</Button>
      </div>
    </Modal>
  );
}
