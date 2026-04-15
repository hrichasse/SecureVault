'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion } from 'framer-motion'

interface AuditLog {
  id: string
  action: string
  user?: { email: string; name: string }
  metadata?: Record<string, string>
  ipAddress?: string
  createdAt: string
}

const actionVariant: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  LOGIN: 'info', LOGOUT: 'info', REGISTER: 'info',
  UPLOAD_DOCUMENT: 'success', VIEW_DOCUMENT: 'neutral',
  DELETE_DOCUMENT: 'danger',
  REQUEST_ACCESS: 'neutral', APPROVE_REQUEST: 'success',
  REJECT_REQUEST: 'warning',
  CREATE_INCIDENT: 'danger', UPDATE_INCIDENT: 'warning', CLOSE_INCIDENT: 'success',
  CERTIFY_DOCUMENT: 'success', VERIFY_DOCUMENT: 'info',
  GRANT_PERMISSION: 'success', REVOKE_PERMISSION: 'warning',
}

function getDetail(log: AuditLog): string {
  if (log.metadata?.documentName) return log.metadata.documentName
  if (log.metadata?.detail) return log.metadata.detail
  return log.action.replace(/_/g, ' ').toLowerCase()
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit?limit=50')
      .then(res => res.json())
      .then(data => setLogs(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    window.open('/api/audit/export', '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Auditoría</h1></div>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-card rounded border border-border animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoría</h1>
          <p className="text-sm text-muted-foreground">Registro completo de acciones en la plataforma</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar logs
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalle</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha / Hora</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-3 px-4">
                    <StatusBadge variant={actionVariant[log.action] || 'neutral'}>{log.action}</StatusBadge>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-card-foreground">{log.user?.email || 'Sistema'}</td>
                  <td className="py-3 px-4 text-sm text-card-foreground">{getDetail(log)}</td>
                  <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{log.ipAddress || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('es-CL')}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No hay registros de auditoría.</div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {logs.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card rounded-xl border border-border p-4 shadow-card space-y-2"
          >
            <div className="flex items-center justify-between">
              <StatusBadge variant={actionVariant[log.action] || 'neutral'}>{log.action}</StatusBadge>
              <span className="text-xs font-mono text-muted-foreground">{log.ipAddress || 'N/A'}</span>
            </div>
            <p className="text-sm text-card-foreground">{getDetail(log)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono truncate mr-2">{log.user?.email || 'Sistema'}</span>
              <span className="whitespace-nowrap">{new Date(log.createdAt).toLocaleString('es-CL')}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
