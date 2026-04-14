import { Skeleton } from '@/components/ui/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[0, 1].map((i) => (
          <div key={i} className="card p-6 space-y-6">
            <Skeleton className="h-6 w-40 border-b border-[#334155]/60 pb-4" />
            <div className="space-y-4">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
