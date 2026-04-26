// ─── Skeleton primitives ──────────────────────────────────────────────────────

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
  );
}

// ─── Stat cards row skeleton ──────────────────────────────────────────────────
export function StatCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-16" />
          <SkeletonBlock className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-slate-100 last:border-0 px-4 py-3.5 flex gap-6 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonBlock
              key={j}
              className={`h-3.5 flex-1 ${j === 0 ? 'max-w-[80px]' : j === cols - 1 ? 'max-w-[60px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Detail page skeleton ─────────────────────────────────────────────────────
export function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 space-y-4">
              <SkeletonBlock className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="space-y-2">
                    <SkeletonBlock className="h-3 w-20" />
                    <SkeletonBlock className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <SkeletonBlock className="h-4 w-24" />
            {[1, 2, 3].map(i => (
              <SkeletonBlock key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-36" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
      </div>
      <StatCardsSkeleton count={5} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-[200px] w-full rounded-lg" />
        </div>
        <div className="card p-5 space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
