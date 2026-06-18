import { Skeleton } from "@presentation/components/ui/skeleton"
import { PageHeaderSkeleton } from "@presentation/components/ui/page-header"
import { StatCardSkeleton } from "@presentation/components/ui/skeletons/stat-card-skeleton"
import { CardSkeleton } from "@presentation/components/ui/skeletons/card-skeleton"

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderSkeleton />

      {/* Toolbar: timeframe dropdown + filter + export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex space-x-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
      </div>

      {/* Overview tab content — 4 summary cards */}
      <div className="grid gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} lines={3} iconSize="sm" valueWidth="w-28" />
        ))}
      </div>

      {/* 2 Charts: Bar chart + Pie chart */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar chart */}
        <CardSkeleton hasTitle titleWidth="w-36">
          <div className="flex items-end justify-around h-48 px-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton
                  className="w-6 rounded-t"
                  style={{ height: `${20 + Math.random() * 60}px` }}
                />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </CardSkeleton>

        {/* Pie chart */}
        <CardSkeleton hasTitle titleWidth="w-36">
          <div className="flex items-center justify-center h-48">
            <Skeleton className="h-36 w-36 rounded-full" />
          </div>
        </CardSkeleton>
      </div>

      {/* Insights section — 3 stat cards */}
      <CardSkeleton titleWidth="w-36">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1 h-7 w-20" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          ))}
        </div>
      </CardSkeleton>
    </div>
  )
}
