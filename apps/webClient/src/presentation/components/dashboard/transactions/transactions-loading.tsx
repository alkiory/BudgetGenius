import { DataTableSkeleton } from "@presentation/components/ui/data-table-skeleton";
import { PageHeaderSkeleton } from "@presentation/components/ui/page-header";
import { Skeleton } from "@presentation/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderSkeleton />

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      <DataTableSkeleton
        columns={[
          { width: "w-24", isCheckbox: true },
          { width: "w-24" },
          { width: "w-32" },
          { width: "w-24" },
          { width: "w-16", isBadge: true },
          { width: "w-20" },
        ]}
        rows={6}
      />
    </div>
  );
}
