import { IncidentCard } from './IncidentCard'
import type { IncidentStatus, IncidentPriority, IncidentType } from '@/types'

interface Incident {
  id: string
  title: string
  status: IncidentStatus
  priority: IncidentPriority
  type: IncidentType
  createdAt: Date
  document?: { name: string } | null
  assignedTo?: { name: string } | null
}

export function IncidentList({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-center">
        <svg className="w-12 h-12 text-[#334155] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-[#64748b] text-sm font-medium">No hay incidentes reportados</p>
        <p className="text-[#475569] text-xs mt-1">
          Los incidentes o anomalías aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {incidents.map((inc) => (
        <IncidentCard key={inc.id} {...inc} />
      ))}
    </div>
  )
}
