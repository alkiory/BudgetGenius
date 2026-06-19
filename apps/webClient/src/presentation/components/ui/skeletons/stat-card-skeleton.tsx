import { Skeleton } from "../skeleton";

interface StatCardSkeletonProps {
  /** Number of skeleton lines: 2 = icon+label + value, 3 = adds subtitle */
  lines?: 2 | 3;
  /** Size of the icon circle */
  iconSize?: "sm" | "md";
  /** Width of the value skeleton */
  valueWidth?: string;
}

const iconSizeMap = { sm: "h-7 w-7", md: "h-10 w-10" };

/**
 * Reusable skeleton for stat/overview cards (icon circle + label + value + optional subtitle).
 */
export function StatCardSkeleton({
  lines = 2,
  iconSize = "md",
  valueWidth = "w-32",
}: StatCardSkeletonProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <Skeleton
          className={`${iconSizeMap[iconSize]} rounded-full shrink-0`}
        />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className={`mt-4 h-8 ${valueWidth}`} />
      {lines === 3 && <Skeleton className="mt-1 h-3 w-28" />}
    </div>
  );
}

/**
 * Renders a grid of StatCardSkeleton for use in page loading states.
 */
export function StatCardGridSkeleton({
  count = 3,
  cols = 3,
  lines = 2,
  iconSize = "md",
  valueWidth = "w-32",
}: {
  count?: number;
  cols?: number;
} & StatCardSkeletonProps) {
  return (
    <div className={`grid gap-4 md:grid-cols-${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton
          key={i}
          lines={lines}
          iconSize={iconSize}
          valueWidth={valueWidth}
        />
      ))}
    </div>
  );
}
