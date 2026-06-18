import { Skeleton } from "../skeleton"
import type { ReactNode } from "react"

interface CardSkeletonProps {
  /** If true, renders a title bar at the top */
  hasTitle?: boolean
  /** Width of the title skeleton */
  titleWidth?: string
  /** Content rendered inside the card body */
  children: ReactNode
  /** Optional additional classes */
  className?: string
}

/**
 * Reusable skeleton for a card container with optional title bar.
 */
export function CardSkeleton({
  hasTitle = false,
  titleWidth = "w-32",
  children,
  className = "",
}: CardSkeletonProps) {
  return (
    <div className={`rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800 ${className}`}>
      {hasTitle && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton className={`h-5 ${titleWidth}`} />
          <Skeleton className="h-4 w-16" />
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * A simple pie chart skeleton (circle) inside a card with optional title.
 */
export function PieChartCardSkeleton({ hasTitle = true }: { hasTitle?: boolean }) {
  return (
    <CardSkeleton hasTitle={hasTitle} titleWidth="w-36">
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
    </CardSkeleton>
  )
}

/**
 * A progress bar skeleton row (label + bar + stats).
 */
export function ProgressBarSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between mt-1">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

/**
 * A goal card skeleton that mirrors the exact layout of the real GoalCard component.
 * Includes: icon + title/desc, progress bar, stats grid, and action button.
 */
export function GoalCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* Header: icon + title/desc + action buttons */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Progress bar section */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Stats grid: 2x2 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Days remaining */}
      <Skeleton className="mt-2 h-3 w-28" />

      {/* Add Progress button */}
      <Skeleton className="mt-4 h-9 w-full rounded-md" />
    </div>
  )
}

/**
 * A list item skeleton row (icon + text on left, amount on right).
 */
export function ListItemSkeleton({
  iconSize = "h-9 w-9",
  textWidth = "w-36",
  subTextWidth = "w-24",
  amountWidth = "w-20",
}: {
  iconSize?: string
  textWidth?: string
  subTextWidth?: string
  amountWidth?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <Skeleton className={`${iconSize} rounded-full shrink-0`} />
        <div>
          <Skeleton className={`h-4 ${textWidth}`} />
          <Skeleton className={`mt-1 h-3 ${subTextWidth}`} />
        </div>
      </div>
      <Skeleton className={`h-4 ${amountWidth} shrink-0`} />
    </div>
  )
}
