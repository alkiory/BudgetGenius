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
      className={`fixed inset-0 z-10 flex items-center justify-center p-4
        ${isOpen ? "animate-in fade-in" : "animate-out fade-out"}
        ${className}`}
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-50 w-full max-w-md rounded-lg p-6 shadow-lg bg-slate-50 dark:bg-slate-800 ${
          isOpen ? "animate-in zoom-in-95" : "animate-out zoom-out-95"
        }`}
      >
        <div className="flex items-center justify-between">
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
        <div className="mt-4 text-slate-700 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
}
