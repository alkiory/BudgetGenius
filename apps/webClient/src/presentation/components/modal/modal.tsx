import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    // Add a small delay when opening to allow for animation
    if (isOpen) {
      setIsShowing(true);
    } else {
      const timer = setTimeout(() => {
        setIsShowing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isShowing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4
        ${isOpen ? "animate-in fade-in" : "animate-out fade-out"}
        ${className}`}
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      {/*
        The panel owns the height budget: it never grows past the
        viewport, the header stays pinned, and only the body scrolls.
        `overflow-hidden` on the panel plus `min-h-0 flex-1` on the
        body is what stops tall forms (e.g. Edit Transaction with the
        Recurrence field) from spilling outside the rounded corners
        and pushing the action buttons off-screen.
      */}
      <div
        className={`relative z-50 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-slate-50 p-4 shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:p-6 dark:bg-slate-800 ${
          isOpen ? "animate-in zoom-in-95" : "animate-out zoom-out-95"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* `whitespace-normal break-words` resets any `nowrap`
            inherited from the table cell that opened the modal —
            without it, helper text and long labels stay on one line
            and push past the modal's right edge. */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain whitespace-normal break-words pr-1 text-slate-700 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
}
