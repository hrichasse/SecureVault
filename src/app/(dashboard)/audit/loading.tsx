import { Skeleton, TableRowSkeleton } from '@/components/ui/Skeleton'

export default function AuditLoading() {
  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Filters skeleton */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-40 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]/60">
              {['Fecha', 'Acción', 'Usuario', 'Documento', 'IP'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]/40">
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
