import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardMetrics, getRecentActivity } from '@/modules/audit/audit.service'
import type { DashboardMetrics } from '@/types'

export const metadata: Metadata = {
  title: 'Dashboard',
}

interface MetricCardProps {
  title: string
  value: number
  description: string
  icon: React.ReactNode
  accent: string
  bg: string
}

function MetricCard({ title, value, description, icon, accent, bg }: MetricCardProps) {
  return (
    <div className="metric-card group">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#94a3b8]">{title}</p>
          <p className={`text-3xl font-bold mt-1.5 ${accent}`}>
            {value.toLocaleString('es-ES')}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <p className="text-xs text-[#64748b] pt-1">{description}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true },
  })
  if (!dbUser) redirect('/login')

  const metrics = await getDashboardMetrics(dbUser.companyId)
  const recentActivity = await getRecentActivity(dbUser.companyId, 5)
  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="page-title text-2xl">Dashboard</h1>
        <p className="page-subtitle">Resumen de actividad de tu organización</p>
      </div>

      {/* Metric cards */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Total documentos"
            value={metrics.totalDocuments}
            description="Documentos activos en el vault"
            accent="text-[#3b82f6]"
            bg="bg-[#3b82f6]/10"
            icon={
              <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
          />

          <MetricCard
            title="Solicitudes pendientes"
            value={metrics.pendingRequests}
            description="Solicitudes de acceso en revisión"
            accent="text-[#f59e0b]"
            bg="bg-[#f59e0b]/10"
            icon={
              <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
              </svg>
            }
          />

          <MetricCard
            title="Incidentes abiertos"
            value={metrics.openIncidents}
            description="Incidentes de seguridad sin resolver"
            accent="text-[#ef4444]"
            bg="bg-[#ef4444]/10"
            icon={
              <svg className="w-5 h-5 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
          />

          <MetricCard
            title="Certificaciones emitidas"
            value={metrics.issuedCertifications}
            description="Certificados de autenticidad activos"
            accent="text-[#10b981]"
            bg="bg-[#10b981]/10"
            icon={
              <svg className="w-5 h-5 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Activity and other panels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#334155]/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Actividad reciente</h2>
            <Link href="/audit" className="text-xs text-[#3b82f6] hover:underline">Ver todo</Link>
          </div>
          <div className="flex-1 overflow-auto">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <svg className="w-10 h-10 text-[#334155] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p className="text-[#64748b] text-sm">Sin actividad registrada todavía</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#334155]/60">
                {recentActivity.map(activity => (
                  <li key={activity.id} className="p-4 hover:bg-[#1e293b]/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center flex-shrink-0 text-xs text-[#94a3b8]">
                        {activity.user?.name ? activity.user.name.charAt(0) : 'S'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#e2e8f0]">
                          <span className="font-semibold">{activity.user?.name || 'Sistema'}</span>{' '}
                          realizó <span className="font-mono text-xs bg-[#0f172a] px-1 rounded text-[#8b5cf6]">{activity.action}</span>
                        </p>
                        {activity.document && (
                          <p className="text-xs text-[#94a3b8] mt-0.5 truncate">
                            Doc: {activity.document.name}
                          </p>
                        )}
                        <p className="text-[10px] text-[#64748b] mt-1">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#e2e8f0]">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/documents" className="p-4 rounded-xl border border-[#334155]/60 bg-[#1e293b] hover:border-[#475569] transition-all flex flex-col items-center gap-2 text-center group">
               <svg className="w-6 h-6 text-[#3b82f6] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
               </svg>
               <span className="text-xs font-semibold text-[#e2e8f0]">Bóveda de Documentos</span>
            </Link>
            <Link href="/requests" className="p-4 rounded-xl border border-[#334155]/60 bg-[#1e293b] hover:border-[#475569] transition-all flex flex-col items-center gap-2 text-center group">
               <svg className="w-6 h-6 text-[#f59e0b] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
               </svg>
               <span className="text-xs font-semibold text-[#e2e8f0]">Solicitudes de Acceso</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
