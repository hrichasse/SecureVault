'use client'

import { useState, useCallback, useTransition } from 'react'
import type { AuditAction } from '@/types'

// ── Types ──────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  action: AuditAction
  createdAt: string
  ipAddress?: string | null
  user?: { name: string; email: string } | null
  document?: { id: string; name: string } | null
}

interface AuditResponse {
  data: AuditLogEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── Action labels ──────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN:            'Inicio de sesión',
  LOGOUT:           'Cierre de sesión',
  REGISTER:         'Registro',
  UPLOAD_DOCUMENT:  'Subida documento',
  VIEW_DOCUMENT:    'Vista documento',
  DELETE_DOCUMENT:  'Eliminación documento',
  REQUEST_ACCESS:   'Solicitud de acceso',
  APPROVE_REQUEST:  'Aprobación de solicitud',
  REJECT_REQUEST:   'Rechazo de solicitud',
  CREATE_INCIDENT:  'Incidente creado',
  UPDATE_INCIDENT:  'Incidente actualizado',
  CLOSE_INCIDENT:   'Incidente cerrado',
  CERTIFY_DOCUMENT: 'Certif. documento',
  VERIFY_DOCUMENT:  'Verif. documento',
  GRANT_PERMISSION: 'Permiso otorgado',
  REVOKE_PERMISSION:'Permiso revocado',
}

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  LOGIN:            'text-[#3b82f6] bg-[#3b82f6]/10',
  LOGOUT:           'text-[#64748b] bg-[#64748b]/10',
  REGISTER:         'text-[#8b5cf6] bg-[#8b5cf6]/10',
  UPLOAD_DOCUMENT:  'text-[#10b981] bg-[#10b981]/10',
  DELETE_DOCUMENT:  'text-[#ef4444] bg-[#ef4444]/10',
  REQUEST_ACCESS:   'text-[#f59e0b] bg-[#f59e0b]/10',
  APPROVE_REQUEST:  'text-[#10b981] bg-[#10b981]/10',
  REJECT_REQUEST:   'text-[#ef4444] bg-[#ef4444]/10',
  CREATE_INCIDENT:  'text-[#ef4444] bg-[#ef4444]/10',
  CLOSE_INCIDENT:   'text-[#10b981] bg-[#10b981]/10',
  CERTIFY_DOCUMENT: 'text-[#8b5cf6] bg-[#8b5cf6]/10',
  VERIFY_DOCUMENT:  'text-[#8b5cf6] bg-[#8b5cf6]/10',
}

const AUDIT_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[]

// ── Helper ─────────────────────────────────────────────────────

function buildUrl(filters: {
  page: number
  action?: string
  startDate?: string
  endDate?: string
  documentId?: string
}) {
  const params = new URLSearchParams()
  params.set('page', String(filters.page))
  params.set('limit', '20')
  if (filters.action)     params.set('action',     filters.action)
  if (filters.startDate)  params.set('startDate',  filters.startDate)
  if (filters.endDate)    params.set('endDate',     filters.endDate)
  if (filters.documentId) params.set('documentId', filters.documentId)
  return `/api/audit?${params.toString()}`
}

// ── Component ──────────────────────────────────────────────────

interface AuditClientProps {
  initial: AuditResponse
}

export function AuditClient({ initial }: AuditClientProps) {
  const [data, setData]           = useState<AuditResponse>(initial)
  const [action, setAction]       = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [documentId, setDocId]    = useState('')
  const [isPending, startTrans]   = useTransition()
  const [exportLoading, setExportLoading] = useState(false)

  const fetchPage = useCallback(
    (page: number, overrides?: Partial<{ action: string; startDate: string; endDate: string; documentId: string; page: number }>) => {
      const filters = { action, startDate, endDate, documentId, page, ...overrides }
      startTrans(async () => {
        const res = await fetch(buildUrl(filters))
        if (res.ok) setData(await res.json())
      })
    },
    [action, startDate, endDate, documentId]
  )

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPage(1)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const params = new URLSearchParams()
      if (action)     params.set('action',     action)
      if (startDate)  params.set('startDate',  startDate)
      if (endDate)    params.set('endDate',     endDate)
      if (documentId) params.set('documentId', documentId)

      const res = await fetch(`/api/audit/export?${params.toString()}`)
      if (!res.ok) return

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <form
        onSubmit={handleFilter}
        className="card p-4 flex flex-wrap gap-3 items-end"
      >
        {/* Action filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">
            Acción
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm bg-[#0f172a] border border-[#334155] text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6] min-w-[180px]"
          >
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">
            Desde
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm bg-[#0f172a] border border-[#334155] text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">
            Hasta
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm bg-[#0f172a] border border-[#334155] text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        {/* Document ID */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">
            ID Documento
          </label>
          <input
            type="text"
            placeholder="ID del documento…"
            value={documentId}
            onChange={(e) => setDocId(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm bg-[#0f172a] border border-[#334155] text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] w-44"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => {
              setAction(''); setStartDate(''); setEndDate(''); setDocId('')
              fetchPage(1, { action: '', startDate: '', endDate: '', documentId: '' })
            }}
            className="h-9 px-4 rounded-lg text-sm border border-[#334155] text-[#94a3b8] hover:border-[#475569] hover:text-[#e2e8f0] transition-colors"
          >
            Limpiar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-9 px-4 rounded-lg text-sm bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb] transition-colors disabled:opacity-60"
          >
            Filtrar
          </button>
        </div>
      </form>

      {/* ── Stats bar ── */}
      <div className="flex items-center justify-between text-sm text-[#64748b]">
        <span>
          {isPending
            ? 'Cargando…'
            : `${data.total.toLocaleString('es-ES')} evento${data.total !== 1 ? 's' : ''} encontrado${data.total !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm bg-[#1e293b] border border-[#334155] text-[#e2e8f0] hover:border-[#475569] transition-colors disabled:opacity-60"
        >
          {exportLoading ? (
            <svg className="w-4 h-4 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Exportar CSV
        </button>
      </div>

      {/* ── Table ── */}
      <div className={`card p-0 overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]/60 bg-[#0f172a]/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/40">
              {data.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-[#64748b]">
                    No se encontraron eventos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                data.data.map((log) => {
                  const colorClass = ACTION_COLORS[log.action] ?? 'text-[#94a3b8] bg-[#94a3b8]/10'
                  return (
                    <tr key={log.id} className="hover:bg-[#1e293b]/40 transition-colors">
                      <td className="px-4 py-3 text-[#94a3b8] text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div>
                            <p className="text-[#e2e8f0] font-medium text-xs">{log.user.name}</p>
                            <p className="text-[#64748b] text-[11px]">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-[#64748b] text-xs">Sistema</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] text-xs truncate max-w-[180px]">
                        {log.document?.name ?? <span className="text-[#475569]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs font-mono">
                        {log.ipAddress ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="border-t border-[#334155]/60 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              Página {data.page} de {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchPage(data.page - 1)}
                disabled={data.page <= 1 || isPending}
                className="h-8 px-3 rounded text-xs border border-[#334155] text-[#94a3b8] disabled:opacity-40 hover:border-[#475569] transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => fetchPage(data.page + 1)}
                disabled={data.page >= data.totalPages || isPending}
                className="h-8 px-3 rounded text-xs border border-[#334155] text-[#94a3b8] disabled:opacity-40 hover:border-[#475569] transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
