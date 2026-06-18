import { Skeleton } from "@presentation/components/ui/skeleton"
import { DataTableSkeleton } from "@presentation/components/ui/data-table-skeleton"
import { PageHeaderSkeleton } from "@presentation/components/ui/page-header"
import { StatCardSkeleton } from "@presentation/components/ui/skeletons/stat-card-skeleton"
import { CardSkeleton } from "@presentation/components/ui/skeletons/card-skeleton"

export default function IncomesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderSkeleton />

      {/* 3 Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        {[0, 1, 2].map((i) => (
          <StatCardSkeleton key={i} lines={3} valueWidth="w-32" />
        ))}
      </div>

      {/* 2 Chart cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <CardSkeleton hasTitle titleWidth="w-36">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardSkeleton>
        <CardSkeleton hasTitle titleWidth="w-36">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>

      {/* Search + Filter + Add bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      <DataTableSkeleton
        columns={[
          { width: "w-24" },
          { width: "w-32" },
          { width: "w-24" },
          { width: "w-20" },
          { width: "w-20" },
        ]}
        rows={4}
      />
    </div>
  )
}
