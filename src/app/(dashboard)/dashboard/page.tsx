'use client'

import { useEffect, useState } from 'react'
import { FileText, Send, AlertTriangle, ShieldCheck, Clock, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface DashboardMetrics {
  totalDocuments: number
  pendingRequests: number
  activeIncidents: number
  totalCertifications: number
}

interface ActivityItem {
  action: string
  detail: string
  time: string
  type: 'info' | 'success' | 'danger' | 'warning'
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

// Mapeo de AuditAction a tipo de badge
const actionTypeMap: Record<string, 'info' | 'success' | 'danger' | 'warning'> = {
  LOGIN: 'info', LOGOUT: 'info', REGISTER: 'info',
  UPLOAD_DOCUMENT: 'success', VIEW_DOCUMENT: 'info',
  DELETE_DOCUMENT: 'danger',
  REQUEST_ACCESS: 'warning',
  APPROVE_REQUEST: 'success', REJECT_REQUEST: 'danger',
  CREATE_INCIDENT: 'danger', UPDATE_INCIDENT: 'warning', CLOSE_INCIDENT: 'success',
  CERTIFY_DOCUMENT: 'success', VERIFY_DOCUMENT: 'info',
  GRANT_PERMISSION: 'success', REVOKE_PERMISSION: 'warning',
}

const actionLabelMap: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  REGISTER: 'Registro',
  UPLOAD_DOCUMENT: 'Documento subido',
  VIEW_DOCUMENT: 'Documento visto',
  DELETE_DOCUMENT: 'Documento eliminado',
  REQUEST_ACCESS: 'Solicitud creada',
  APPROVE_REQUEST: 'Solicitud aprobada',
  REJECT_REQUEST: 'Solicitud rechazada',
  CREATE_INCIDENT: 'Incidente reportado',
  UPDATE_INCIDENT: 'Incidente actualizado',
  CLOSE_INCIDENT: 'Incidente cerrado',
  CERTIFY_DOCUMENT: 'Certificación emitida',
  VERIFY_DOCUMENT: 'Verificación realizada',
  GRANT_PERMISSION: 'Permiso otorgado',
  REVOKE_PERMISSION: 'Permiso revocado',
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [chartData, setChartData] = useState<Array<{ mes: string; documentos: number; solicitudes: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch metrics
        const [docsRes, reqRes, incRes, certRes, auditRes] = await Promise.all([
          fetch('/api/documents?limit=1'),
          fetch('/api/access-requests?status=PENDING&limit=1'),
          fetch('/api/incidents?status=OPEN&limit=1'),
          fetch('/api/certifications?limit=1'),
          fetch('/api/audit?limit=5'),
        ])

        const docsData = await docsRes.json()
        const reqData = await reqRes.json()
        const incData = await incRes.json()
        const certData = await certRes.json()
        const auditData = await auditRes.json()

        setMetrics({
          totalDocuments: docsData.pagination?.total ?? docsData.data?.length ?? 0,
          pendingRequests: reqData.pagination?.total ?? reqData.data?.length ?? 0,
          activeIncidents: incData.pagination?.total ?? incData.data?.length ?? 0,
          totalCertifications: certData.pagination?.total ?? certData.data?.length ?? 0,
        })

        // Parse audit logs as recent activity
        if (auditData.data) {
          const mapped: ActivityItem[] = auditData.data.map((log: Record<string, unknown>) => {
            const action = log.action as string
            return {
              action: actionLabelMap[action] || action,
              detail: (log.metadata as Record<string, string>)?.documentName || (log.user as Record<string, string>)?.email || '',
              time: new Date(log.createdAt as string).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit' }),
              type: actionTypeMap[action] || 'info',
            }
          })
          setActivity(mapped)
        }

        // Generate chart data (mock monthly — real would need an aggregation endpoint)
        setChartData([
          { mes: 'Ene', documentos: Math.floor(Math.random() * 50) + 20, solicitudes: Math.floor(Math.random() * 20) + 5 },
          { mes: 'Feb', documentos: Math.floor(Math.random() * 50) + 30, solicitudes: Math.floor(Math.random() * 20) + 8 },
          { mes: 'Mar', documentos: Math.floor(Math.random() * 50) + 40, solicitudes: Math.floor(Math.random() * 20) + 10 },
          { mes: 'Abr', documentos: Math.floor(Math.random() * 50) + 50, solicitudes: Math.floor(Math.random() * 20) + 12 },
          { mes: 'May', documentos: Math.floor(Math.random() * 50) + 60, solicitudes: Math.floor(Math.random() * 20) + 15 },
          { mes: 'Jun', documentos: docsData.pagination?.total ?? 0, solicitudes: reqData.pagination?.total ?? 0 },
        ])
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Dashboard</h1></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general de la plataforma</p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <StatCard title="Documentos totales" value={metrics?.totalDocuments ?? 0} icon={FileText} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Solicitudes pendientes" value={metrics?.pendingRequests ?? 0} icon={Send} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Incidentes activos" value={metrics?.activeIncidents ?? 0} icon={AlertTriangle} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Certificaciones" value={metrics?.totalCertifications ?? 0} icon={ShieldCheck} />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-card-foreground text-sm sm:text-base">Documentos por mes</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
              />
              <Bar dataKey="documentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-card-foreground text-sm sm:text-base">Solicitudes de acceso</h3>
            <Send className="h-4 w-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
              />
              <Line type="monotone" dataKey="solicitudes" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ fill: 'hsl(var(--secondary))' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-card-foreground text-sm sm:text-base">Actividad reciente</h3>
        </div>
        <div className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay actividad reciente</p>
          ) : (
            activity.map((act, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <StatusBadge variant={act.type}>{act.action}</StatusBadge>
                  <span className="text-xs sm:text-sm text-card-foreground">{act.detail}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap pl-0 sm:pl-2">{act.time}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
