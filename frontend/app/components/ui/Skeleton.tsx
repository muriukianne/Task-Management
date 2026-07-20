import { type CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** A single animated shimmer block. Compose these to match your content shapes. */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 ${className}`}
    />
  );
}

/** Skeleton row that matches a task table row */
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-[var(--border)]">
      <Skeleton className="h-4 flex-1 max-w-[40%]" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-7 rounded-lg" />
    </div>
  );
}

/** Skeleton card for Kanban columns */
export function TaskCardSkeleton() {
  return (
    <div className="p-3.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 bg-[var(--surface)] space-y-2.5 shadow-sm">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for the stats bar */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Skeleton className="h-7 w-10 mx-auto mb-2" />
          <Skeleton className="h-3 w-14 mx-auto rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Full table loading state */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        {[40, 16, 16, 20, 20, 8].map((w, i) => (
          <Skeleton key={i} className={`h-3 w-[${w}%]`} style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}
