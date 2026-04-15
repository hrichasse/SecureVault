import { RequestActions } from './RequestActions'
import type { UserRole } from '@/types'

interface Request {
  id: string
  status: string
  reason: string | null
  expiresAt: Date | null
  createdAt: Date
  document: { id: string; name: string; confidentialityLevel: string }
  requestedBy: { id: string; name: string; email: string }
  reviewedBy: { name: string } | null
}

interface RequestListProps {
  requests: Request[]
  userRole: UserRole
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-[#f59e0b]/15 text-[#f59e0b]',
  APPROVED: 'bg-[#10b981]/15 text-[#10b981]',
  REJECTED: 'bg-[#ef4444]/15 text-[#ef4444]',
  CANCELLED: 'bg-[#64748b]/15 text-[#64748b]',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
}

export function RequestList({ requests, userRole }: RequestListProps) {
  const isReviewer = userRole === 'ADMIN' || userRole === 'ADMIN_COMPANY'

  if (requests.length === 0) {
    return (
      <div className="card p-12 text-center text-[#64748b]">
        No hay solicitudes de acceso.
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-[#94a3b8] uppercase bg-[#1e293b] border-b border-[#334155]">
            <tr>
              <th className="px-6 py-4">Documento</th>
              {isReviewer && <th className="px-6 py-4">Solicitante</th>}
              <th className="px-6 py-4">Motivo</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Fecha</th>
              {isReviewer && <th className="px-6 py-4 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]/60">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-[#1e293b]/50 transition-colors">
                <td className="px-6 py-4 font-medium text-[#e2e8f0]">
                  <a href={`/documents/${req.document.id}`} className="hover:text-[#3b82f6]">
                    {req.document.name}
                  </a>
                </td>
                {isReviewer && (
                  <td className="px-6 py-4">
                    <div className="text-[#e2e8f0]">{req.requestedBy.name}</div>
                    <div className="text-[#64748b] text-xs">{req.requestedBy.email}</div>
                  </td>
                )}
                <td className="px-6 py-4 text-[#94a3b8] max-w-xs truncate" title={req.reason || ''}>
                  {req.reason}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[req.status] || statusColors.CANCELLED}`}>
                    {statusLabels[req.status] || req.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[#64748b]">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                {isReviewer && (
                  <td className="px-6 py-4 flex justify-end">
                    {req.status === 'PENDING' ? (
                      <RequestActions requestId={req.id} />
                    ) : (
                      <span className="text-xs text-[#64748b]">
                        Revisado por {req.reviewedBy?.name || '---'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
