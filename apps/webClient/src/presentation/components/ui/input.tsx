import { Eye, EyeOff } from "@presentation/components/ui/animated-icons";
import React, { useState } from "react";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", type, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = type === "password" && showPassword ? "text" : type;

  return (
    <div className="relative">
      <input
        className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${className}`}
        ref={ref}
        type={inputType}
        {...props}
      />
      {/* Botón para mostrar/ocultar contraseña */}
      {type === "password" && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400 text-sm leading-5"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
