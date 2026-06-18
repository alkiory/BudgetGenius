import { Skeleton } from "@presentation/components/ui/skeleton"
import { PageHeaderSkeleton } from "@presentation/components/ui/page-header"
import { GoalCardSkeleton } from "@presentation/components/ui/skeletons/card-skeleton"

export default function GoalsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Overall progress card */}
      <Skeleton className="h-48 w-full" />

      {/* Search + filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
      </div>

      {/* Goal cards grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <GoalCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
