import { forwardRef } from "react";

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 
          focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"}
          ${className || ""}
        `}
        onClick={() => onChange?.(!checked)}
        {...props}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg 
            ring-0 transition-transform duration-200 ease-in-out dark:bg-gray-950
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";

export { Switch };
