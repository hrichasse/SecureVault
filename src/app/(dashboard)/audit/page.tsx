import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getAuditLogs } from '@/modules/audit/audit.service'
import type { AuditAction } from '@/types'


export const metadata: Metadata = { title: 'Auditoría' }

interface PageProps {
  searchParams: {
    page?: string
    action?: string
  }
}

const ACTIONS: AuditAction[] = [
  'LOGIN', 'LOGOUT', 'REGISTER', 'UPLOAD_DOCUMENT', 'VIEW_DOCUMENT',
  'DELETE_DOCUMENT', 'REQUEST_ACCESS', 'APPROVE_REQUEST', 'REJECT_REQUEST',
  'CREATE_INCIDENT', 'UPDATE_INCIDENT', 'CLOSE_INCIDENT', 'CERTIFY_DOCUMENT',
  'VERIFY_DOCUMENT', 'GRANT_PERMISSION', 'REVOKE_PERMISSION'
]

export default async function AuditPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, role: true },
  })
  if (!dbUser) redirect('/login')

  if (dbUser.role === 'USER') redirect('/dashboard') // Redirigir a no admin

  const page = parseInt(searchParams.page || '1', 10)
  const action = (searchParams.action as AuditAction) || undefined

  const { data: logs, pagination } = await getAuditLogs({
    companyId: dbUser.companyId,
    page,
    limit: 15,
    action,
  })

  // URL builder for Export CSV
  const exportUrl = `/api/audit/export${action ? `?action=${action}` : ''}`

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl flex items-center gap-3">
            <svg className="w-8 h-8 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Registro de Auditoría (Audit Log)
          </h1>
          <p className="page-subtitle">Monitoreo y trazabilidad de todos los eventos del sistema</p>
        </div>
        <a
          href={exportUrl}
          target="_blank"
          className="btn-secondary whitespace-nowrap text-[#8b5cf6] border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/10"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar CSV
        </a>
      </div>

      <div className="card overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b border-[#334155]/60 bg-[#1e293b]/50 overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748b] mr-2">Filtrar por Acción:</span>
            <a
              href="/audit"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${!action ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/30 text-[#8b5cf6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
                }`}
            >
              Todos
            </a>
            {ACTIONS.map(a => (
              <a
                key={a}
                href={`/audit?action=${a}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${action === a ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/30 text-[#8b5cf6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
                  }`}
              >
                {a}
              </a>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#334155] bg-[#0f172a]/30">
                <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Fecha / Hora</th>
                <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Usuario</th>
                <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Acción</th>
                <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Documento Afectado</th>
                <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider text-right">Detalles (Metadatos)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#334155]/20 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="text-xs text-[#94a3b8]">
                      {new Date(log.createdAt).toLocaleString('es-ES')}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-[#3b82f6] font-bold">
                          {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'S'}
                        </span>
                      </div>
                      <span className="text-xs text-[#e2e8f0]">{log.user?.name || 'Sistema/Anónimo'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 px-2 py-0.5 text-[10px] font-bold tracking-wider">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="text-xs text-[#e2e8f0]">
                      {log.document?.name || <span className="text-[#64748b] italic">N/A</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right max-w-[200px] truncate">
                    <span className="text-[10px] font-mono text-[#64748b]">
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#64748b]">
                    No hay eventos registrados para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[#334155]/60 bg-[#1e293b]/50 flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              Mostrando página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
            </span>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <a href={`/audit?page=${pagination.page - 1}${action ? `&action=${action}` : ''}`} className="btn-secondary px-3 py-1 text-xs">Anterior</a>
              )}
              {pagination.page < pagination.totalPages && (
                <a href={`/audit?page=${pagination.page + 1}${action ? `&action=${action}` : ''}`} className="btn-secondary px-3 py-1 text-xs">Siguiente</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
