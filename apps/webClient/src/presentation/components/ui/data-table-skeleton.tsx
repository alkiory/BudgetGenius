import { Skeleton } from "./skeleton";

interface ColumnSkeleton {
  /** Width class for the skeleton (e.g. "w-24", "w-32") */
  width: string;
  /** If true, renders as a rounded-full badge instead of a straight line */
  isBadge?: boolean;
  /** If true, renders as a checkbox (h-4 w-4 rounded) */
  isCheckbox?: boolean;
}

interface DataTableSkeletonProps {
  /** Column definitions for the table header and rows */
  columns: ColumnSkeleton[];
  /** Number of data rows to render (default 5) */
  rows?: number;
  /** Whether to show the pagination bar (default true) */
  hasPagination?: boolean;
  /** Whether to show action button columns at the end (default true) */
  hasActions?: boolean;
}

function TableSkeletonRow({
  columns,
  hasActions,
}: {
  columns: ColumnSkeleton[];
  hasActions: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 last:border-0 dark:border-slate-700">
      {columns.map((col, i) =>
        col.isCheckbox ? (
          <Skeleton key={i} className="h-4 w-4 rounded shrink-0" />
        ) : col.isBadge ? (
          <Skeleton
            key={i}
            className={`h-5 ${col.width} rounded-full shrink-0`}
          />
        ) : (
          <Skeleton key={i} className={`h-4 ${col.width} shrink-0`} />
        ),
      )}
      {hasActions && (
        <div className="flex gap-2 ml-auto shrink-0">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      )}
    </div>
  );
}

/**
 * Reusable data table skeleton that mimics the structure of a TanStack Table.
 * Renders a bordered container with header row, data rows, and optional pagination.
 */
export function DataTableSkeleton({
  columns,
  rows = 5,
  hasPagination = true,
  hasActions = true,
}: DataTableSkeletonProps) {
  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {/* Header row */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 px-6 py-3">
            {columns.map((col, i) =>
              col.isCheckbox ? (
                <Skeleton key={i} className="h-4 w-4 rounded shrink-0" />
              ) : (
                <Skeleton key={i} className={`h-4 ${col.width} shrink-0`} />
              ),
            )}
            {hasActions && <Skeleton className="h-4 w-16 shrink-0 ml-auto" />}
          </div>
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }, (_, i) => (
          <TableSkeletonRow key={i} columns={columns} hasActions={hasActions} />
        ))}
      </div>

      {/* Pagination */}
      {hasPagination && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      )}
    </>
  );
}
