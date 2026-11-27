import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export const panel =
  "glass-panel hover-glow rounded-xl p-5 shadow-sm transition-shadow";

export const formSelectClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

/** Turns a failed mutation into the toast the backoffice shows everywhere. */
export function useMutationError() {
  const { t } = useTranslation();
  return (error: unknown) => {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? t("superadmin.error");
    toast.error(String(message));
  };
}
