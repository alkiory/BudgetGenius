import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface OverBudgetContainerProps {
  isOverBudget: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps content with a red border + tinted background when over budget.
 * Falls back to a subtle slate border/no tint when within budget.
 */
export function OverBudgetContainer({
  isOverBudget,
  children,
  className = "",
}: OverBudgetContainerProps) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${isOverBudget
        ? "border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30"
        : "border-slate-200 dark:border-slate-700"
        } ${className}`}
    >
      {children}
    </div>
  );
}

interface OverBudgetIconProps {
  isOverBudget: boolean;
  size?: "sm" | "md";
  className?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-5 w-5" };

/**
 * Renders an AlertTriangle icon when over budget.
 */
export function OverBudgetIcon({
  isOverBudget,
  size = "sm",
  className = "",
}: OverBudgetIconProps) {
  if (!isOverBudget) return null;
  return (
    <AlertTriangle
      className={`${sizeMap[size]} shrink-0 text-red-500 dark:text-red-400 ${className}`}
    />
  );
}

interface OverBudgetBadgeProps {
  isOverBudget: boolean;
  text?: string;
  className?: string;
}

/**
 * Renders a small red pill badge with an icon + text.
 * Used to show "15% over" or "2 categories over budget".
 */
export function OverBudgetBadge({
  isOverBudget,
  text,
  className = "",
}: OverBudgetBadgeProps) {
  if (!isOverBudget) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300 ${className}`}
    >
      <AlertTriangle className="h-3 w-3" />
      {text}
    </span>
  );
}

interface OverBudgetHeaderProps {
  isOverBudget: boolean;
  title: string | ReactNode;
  badge?: string;
  iconSize?: "sm" | "md";
  children?: ReactNode;
}

/**
 * A header row with optional over-budget icon + badge + action buttons.
 * Common pattern: [icon] [title text] [badge] [action buttons]
 */
export function OverBudgetHeader({
  isOverBudget,
  title,
  badge,
  iconSize = "sm",
  children,
}: OverBudgetHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <OverBudgetIcon isOverBudget={isOverBudget} size={iconSize} />
        {typeof title === "string" ? (
          <h3 className="text-lg font-medium">{title}</h3>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-2">
        {badge && <OverBudgetBadge isOverBudget={isOverBudget} text={badge} />}
        {children}
      </div>
    </div>
  );
}
