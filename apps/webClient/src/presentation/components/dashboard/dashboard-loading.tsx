import { PageHeaderSkeleton } from "@presentation/components/ui/page-header"
import { StatCardSkeleton } from "@presentation/components/ui/skeletons/stat-card-skeleton"
import { CardSkeleton, ListItemSkeleton, ProgressBarSkeleton, PieChartCardSkeleton } from "@presentation/components/ui/skeletons/card-skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderSkeleton />

      {/* Overview cards (3-column grid) */}
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <StatCardSkeleton key={i} valueWidth="w-32" />
        ))}
      </div>

      {/* Two-column grid: Recent Transactions + Budget Progress */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Transactions (span 2) */}
        <div className="md:col-span-2 lg:col-span-2">
          <CardSkeleton hasTitle titleWidth="w-40">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </CardSkeleton>
        </div>

        {/* Budget Progress (span 1) */}
        <div className="md:col-span-1 lg:col-span-1">
          <CardSkeleton hasTitle titleWidth="w-32">
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <ProgressBarSkeleton key={i} />
              ))}
            </div>
          </CardSkeleton>
        </div>
      </div>

      {/* Two-column grid: Expense Categories (Pie chart) + Savings Goals */}
      <div className="grid gap-6 md:grid-cols-2">
        <PieChartCardSkeleton />

        {/* Savings Goals */}
        <CardSkeleton hasTitle titleWidth="w-28">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <ListItemSkeleton
                key={i}
                textWidth="w-28"
                subTextWidth="w-20"
                amountWidth="w-16"
              />
            ))}
          </div>
        </CardSkeleton>
      </div>
    </div>
  )
}