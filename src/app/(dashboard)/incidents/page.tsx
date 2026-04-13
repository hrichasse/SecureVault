import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getIncidents } from '@/modules/incidents/incident.service'
import { IncidentList } from '@/components/incidents/IncidentList'
import { IncidentForm } from '@/components/incidents/IncidentForm'
import type { IncidentStatus, IncidentPriority, IncidentType } from '@/types'

export const metadata: Metadata = { title: 'Incidentes' }

interface PageProps {
  searchParams: {
    status?: string
    priority?: string
  }
}

const STATUSES: IncidentStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITIES: IncidentPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default async function IncidentsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, role: true },
  })
  if (!dbUser) redirect('/login')

  const status = (searchParams.status as IncidentStatus) || undefined
  const priority = (searchParams.priority as IncidentPriority) || undefined

  const incidents = await getIncidents({
    companyId: dbUser.companyId,
    status,
    priority,
  })

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title text-2xl">Incidentes</h1>
          <p className="page-subtitle">Gestión de anomalías interacciones y reportes de seguridad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Add Incident Panel (Izquierda) ── */}
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Reportar Incidente
            </h2>
            <IncidentForm />
          </div>
        </div>

        {/* ── Incidents List (Derecha) ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Fltros */}
          <div className="flex flex-col gap-3">
            {/* Filtros Status */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-[#64748b] font-medium min-w-[60px]">Estado:</span>
              <a
                href={`/incidents${priority ? `?priority=${priority}` : ''}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  !status ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b]'
                }`}
              >
                Todos
              </a>
              {STATUSES.map((s) => (
                <a
                  key={s}
                  href={`/incidents?status=${s}${priority ? `&priority=${priority}` : ''}`}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    status === s ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
                  }`}
                >
                  {s}
                </a>
              ))}
            </div>

            {/* Filtros Priority */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-[#64748b] font-medium min-w-[60px]">Prioridad:</span>
              <a
                href={`/incidents${status ? `?status=${status}` : ''}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  !priority ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b]'
                }`}
              >
                Todas
              </a>
              {PRIORITIES.map((p) => (
                <a
                  key={p}
                  href={`/incidents?priority=${p}${status ? `&status=${status}` : ''}`}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    priority === p ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          </div>

          <IncidentList incidents={incidents} />
        </div>
      </div>
    </div>
  )
}
