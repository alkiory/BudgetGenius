import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface CustomToastProps {
  message: string;
  type?: "warning" | "info" | "error" | "success";
  duration?: number;
  id?: string;
}

interface ConfirmToastOptions {
  onConfirm: () => void;
  labelCancel?: string;
  labelConfirm?: string;
}

const customToast = ({
  message,
  type = "info",
  duration = 5000,
}: CustomToastProps) => {
  const toastStyles = {
    warning: {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-800 dark:text-amber-200",
      icon: (
        <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
      ),
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-800 dark:text-blue-200",
      icon: <Info className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
    },
    error: {
      bg: "bg-red-50 dark:bg-red-900/30",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      icon: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
    },
    success: {
      bg: "bg-green-50 dark:bg-green-900/30",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-800 dark:text-green-200",
      icon: (
        <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
      ),
    },
  };

  return toast.custom(
    (t) => (
      // Wave 2 [T2.6]: WAI-ARIA `role` + `aria-live` per toast type.
      //   - `alert`/`assertive` for warning + error: screen readers
      //     interrupt the current read-out so destructive outcomes
      //     aren't missed.
      //   - `status`/`polite` for success + info: announce when the AT
      //     user's current utterance finishes, the canonical
      //     non-intrusive pattern.
      // `aria-atomic="true"` ensures the entire toast message is
      // re-announced on change (rather than only the delta). The icon
      // and dismiss button are marked `aria-hidden` so AT users hear
      // only the message text — the icon glyph would otherwise be
      // read aloud.
      <div
        role={type === "error" || type === "warning" ? "alert" : "status"}
        aria-live={
          type === "error" || type === "warning" ? "assertive" : "polite"
        }
        aria-atomic="true"
        className={`${t.visible ? "animate-enter" : "animate-leave"}
          max-w-md w-full ${toastStyles[type].bg} ${toastStyles[type].border}
          shadow-lg rounded-lg pointer-events-auto flex items-center p-4 border
          transition-all duration-300`}
      >
        <div className="flex-shrink-0 mr-3" aria-hidden="true">
          {toastStyles[type].icon}
        </div>
        <div className={`flex-1 text-sm ${toastStyles[type].text}`}>
          {message}
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="ml-4 flex-shrink-0 rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none"
          aria-label="Dismiss notification"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    ),
    { duration },
  );
};

export const warningToast = (message: string, duration?: number, id?: string) =>
  customToast({ message, type: "warning", duration, id });

export const infoToast = (message: string, duration?: number, id?: string) =>
  customToast({ message, type: "info", duration, id });

export const errorToast = (message: string, duration?: number, id?: string) =>
  customToast({ message, type: "error", duration, id });

export const successToast = (message: string, duration?: number, id?: string) =>
  customToast({ message, type: "success", duration, id });

export const confirmToast = (
  message: string,
  options: ConfirmToastOptions,
  duration?: number,
) => {
  return toast.custom(
    (t) => (
      // Wave 2 [T2.6 follow-through]: confirmToast uses `role="alert"` +
      // `aria-live="assertive"` because the user must acknowledge it
      // (Cancel/Delete buttons). We previously used `role="alertdialog"`
      // which is INCORRECT for this UI: `alertdialog` requires modal
      // semantics + a focus trap, neither of which this bottom-of-page
      // toast implements. The choice mirrors the `errorToast`/`warningToast`
      // assertive announcement pattern. Migrating to a true modal
      // (`<dialog>` element + focus trap) is a Wave 3 follow-up.
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`${t.visible ? "animate-enter" : "animate-leave"}
          max-w-md w-full bg-card dark:bg-card dark:text-neutral
          shadow-lg rounded-lg pointer-events-auto flex flex-col items-center justify-between p-4 border
          transition-all duration-300`}
      >
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-3" aria-hidden="true">
            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
          </div>
          <div className="flex-1 text-sm text-slate-400">{message}</div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500 dark:text-slate-300 dark:hover:text-slate-200 dark:focus-visible:ring-slate-400"
            aria-label={options.labelCancel || "Cancel"}
          >
            {options.labelCancel || "Cancel"}
          </button>
          <button
            onClick={() => {
              options.onConfirm();
              toast.dismiss(t.id);
            }}
            className="flex gap-4 rounded-md px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-red-400"
            aria-label={options.labelConfirm || "Accept"}
          >
            {options.labelConfirm || "Accept"}
            <Check className="ml-1 h-4 w-4 inline-block" aria-hidden="true" />
          </button>
        </div>
      </div>
    ),
    { duration },
  );
};
