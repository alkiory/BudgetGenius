import { PageHeaderSkeleton } from "@presentation/components/ui/page-header";
import { Skeleton } from "@presentation/components/ui/skeleton";

export default function BudgetsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
