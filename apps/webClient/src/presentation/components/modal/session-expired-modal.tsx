import { Modal } from "./modal";
import { Button } from "@presentation/components/ui/button";
import { useTranslation } from 'react-i18next';
import { useNavigate } from "react-router";
import { useDispatch } from "react-redux";
import { logoutAction } from "@adapters/slices/auth/authSlice";
import { RoutePaths } from "@presentation/utils/routes";

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionExpiredModal({ isOpen, onClose }: SessionExpiredModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLoginAgain = () => {
    dispatch(logoutAction());
    navigate(`${RoutePaths.Auth}/${RoutePaths.Login}`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('errors.sessionExpiredTitle')}>
      <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t('errors.sessionExpiredDescription')}
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleLoginAgain}>
          {t('auth.signIn')}
        </Button>
      </div>
    </Modal>
  );
}
