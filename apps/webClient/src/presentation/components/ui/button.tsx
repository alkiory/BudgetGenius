import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "primary"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = "", variant = "default", size = "default", ...props },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantStyles = {
      default:
        "bg-gradient-to-br from-teal-400 to-cyan-500 text-slate-950 shadow-[0_10px_30px_-14px_rgb(45_212_191_/_0.9)] hover:brightness-110",
      destructive: "bg-rose-500 text-white hover:bg-rose-500/90",
      outline:
        "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:text-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-white",
      primary: "bg-teal-500 text-slate-950 hover:bg-teal-400",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-100/80",
      ghost:
        "text-slate-900 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-slate-800 dark:hover:text-white",
      link: "text-teal-600 underline-offset-4 hover:underline dark:text-teal-300",
    };

    const sizeStyles = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className} hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`;

    return <button className={combinedClassName} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button };
