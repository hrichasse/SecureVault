import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getIncidentById } from '@/modules/incidents/incident.service'
import { PriorityBadge } from '@/components/incidents/PriorityBadge'
import { StatusBadge } from '@/components/incidents/StatusBadge'
import { IncidentActionPanel } from '@/components/incidents/IncidentActionPanel'
import type { IncidentStatus } from '@/types'

export const metadata: Metadata = { title: 'Detalle del Incidente' }

const TYPE_LABELS: Record<string, string> = {
  ACCESS_DENIED: 'Acceso Denegado',
  DOCUMENT_LOST: 'Documento Perdido',
  DATA_BREACH: 'Filtración de Datos',
  PERMISSION_EXPIRED: 'Permiso Expirado',
  INTEGRITY_FAILURE: 'Fallo de Integridad',
  CLASSIFICATION_ERROR: 'Error Clasificación',
  OTHER: 'Otro',
}

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, role: true },
  })
  if (!dbUser) redirect('/login')

  const incident = await getIncidentById(params.id, dbUser.companyId)
  if (!incident) notFound()

  // Para el combo de asignación, listamos usuarios ADMIN o ADMIN_COMPANY de la empresa
  const assignableUsers = await prisma.user.findMany({
    where: { companyId: dbUser.companyId, role: { in: ['ADMIN', 'ADMIN_COMPANY'] } },
    select: { id: true, name: true },
  })

  const isReviewer = dbUser.role === 'ADMIN' || dbUser.role === 'ADMIN_COMPANY'

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-8">
      {/* Back */}
      <Link
        href="/incidents"
        className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#e2e8f0] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a incidentes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#e2e8f0]">{incident.title}</h1>
              <StatusBadge status={incident.status} />
              <PriorityBadge priority={incident.priority} />
            </div>
            <p className="text-sm text-[#64748b]">
              ID: {incident.id} • Creado el {new Date(incident.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Descripción del problema</h2>
              <p className="text-[#e2e8f0] whitespace-pre-wrap leading-relaxed text-sm">
                {incident.description}
              </p>
            </div>

            {incident.resolution && (
              <div className="pt-4 border-t border-[#334155]/60 mt-4">
                <h2 className="text-xs font-semibold text-[#10b981] uppercase tracking-wider mb-2">Resolución</h2>
                <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-4 text-[#e2e8f0] text-sm">
                  {incident.resolution}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-2">Detalles</h2>
            
            <div>
              <span className="block text-xs text-[#64748b]">Tipo</span>
              <span className="text-sm text-[#e2e8f0]">{TYPE_LABELS[incident.type]}</span>
            </div>

            <div>
              <span className="block text-xs text-[#64748b]">Reportado por</span>
              <span className="text-sm text-[#e2e8f0]">{incident.createdBy.name}</span>
              <span className="block text-xs text-[#64748b]">{incident.createdBy.email}</span>
            </div>

            {incident.document && (
              <div>
                <span className="block text-xs text-[#64748b]">Documento vinculado</span>
                <Link href={`/documents/${incident.document.id}`} className="text-sm text-[#3b82f6] hover:underline flex items-center gap-1 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {incident.document.name}
                </Link>
              </div>
            )}
          </div>

          {/* Action Panel for Admins/Reviewers */}
          {isReviewer ? (
            <IncidentActionPanel
              incidentId={incident.id}
              currentStatus={incident.status as IncidentStatus}
              assignedToId={incident.assignedToId}
              users={assignableUsers}
            />
          ) : (
            <div className="card p-5">
              <span className="block text-xs text-[#64748b] mb-1">Asignado a</span>
              <span className="text-sm text-[#e2e8f0]">
                {incident.assignedTo ? incident.assignedTo.name : 'Sin asignar'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
