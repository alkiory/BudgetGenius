import React from "react";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className = "", ...props }, ref) => (
  <label
    ref={ref}
    className={`text-sm font-medium leading-none text-slate-900 dark:text-slate-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
