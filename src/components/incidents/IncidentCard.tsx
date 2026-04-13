import Link from 'next/link'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import type { IncidentStatus, IncidentPriority, IncidentType } from '@/types'

interface IncidentCardProps {
  id: string
  title: string
  status: IncidentStatus
  priority: IncidentPriority
  type: IncidentType
  createdAt: Date
  document?: { name: string } | null
  assignedTo?: { name: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  ACCESS_DENIED: 'Acceso Denegado',
  DOCUMENT_LOST: 'Documento Perdido',
  DATA_BREACH: 'Filtración de Datos',
  PERMISSION_EXPIRED: 'Permiso Expirado',
  INTEGRITY_FAILURE: 'Fallo de Integridad',
  CLASSIFICATION_ERROR: 'Error Clasificación',
  OTHER: 'Otro',
}

export function IncidentCard({
  id,
  title,
  status,
  priority,
  type,
  createdAt,
  document,
  assignedTo,
}: IncidentCardProps) {
  return (
    <Link
      href={`/incidents/${id}`} // asumiendo que después habrá página de detalle
      className="card p-5 flex flex-col gap-3 hover:border-[#475569] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={status} size="sm" />
        <PriorityBadge priority={priority} size="sm" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#e2e8f0] truncate group-hover:text-white transition-colors">
          {title}
        </h3>
        <p className="text-xs text-[#94a3b8] mt-1">
          {TYPE_LABELS[type] || 'Desconocido'}
        </p>
      </div>

      {(document || assignedTo) && (
        <div className="space-y-1.5 mt-2">
          {document && (
            <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="truncate">{document.name}</span>
            </div>
          )}
          {assignedTo && (
            <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="truncate">Asignado a: {assignedTo.name}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-[#64748b] pt-3 mt-auto border-t border-[#334155]/60">
        <span className="font-mono">#{id.slice(0, 8)}</span>
        <span>{new Date(createdAt).toLocaleDateString()}</span>
      </div>
    </Link>
  )
}
