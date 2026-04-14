import { MetricCardSkeleton, ActivityItemSkeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-[#1e293b]" />
        <div className="h-4 w-64 animate-pulse rounded bg-[#1e293b]" />
      </div>

      {/* Metric cards skeleton */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      </section>

      {/* Activity panel skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-[#334155]/60">
            <div className="h-4 w-32 animate-pulse rounded bg-[#1e293b]" />
          </div>
          <ul>
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </ul>
        </div>
        <div className="card p-6 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[#1e293b]" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#1e293b]" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
