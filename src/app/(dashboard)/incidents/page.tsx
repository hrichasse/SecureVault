'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion } from 'framer-motion'

interface Incident {
  id: string
  title: string
  status: string
  priority: string
  createdBy: { name: string }
  assignedTo?: { name: string }
  createdAt: string
}

const statusFilters = ['Todos', 'Abierto', 'En progreso', 'Cerrado']
const statusDbMap: Record<string, string> = { 'Abierto': 'OPEN', 'En progreso': 'IN_PROGRESS', 'Cerrado': 'CLOSED' }
const statusLabel: Record<string, string> = { OPEN: 'Abierto', IN_PROGRESS: 'En progreso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado' }
const statusVariant: Record<string, 'danger' | 'warning' | 'success' | 'info'> = {
  OPEN: 'danger', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'success',
}
const priorityVariant: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('Todos')

  useEffect(() => {
    fetch('/api/incidents')
      .then(res => res.json())
      .then(data => setIncidents(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeFilter === 'Todos'
    ? incidents
    : incidents.filter(i => i.status === statusDbMap[activeFilter])

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Incidentes</h1></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidentes</h1>
          <p className="text-sm text-muted-foreground">Sistema de gestión de incidentes documentales</p>
        </div>
        <Button className="gradient-primary text-primary-foreground">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Reportar incidente
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusFilters.map(f => (
          <Button
            key={f}
            variant={activeFilter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(f)}
            className={activeFilter === f ? 'gradient-primary text-primary-foreground' : ''}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((inc, i) => (
          <motion.div
            key={inc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-elevated transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge variant={priorityVariant[inc.priority] || 'medium'}>
                    {inc.priority}
                  </StatusBadge>
                  <StatusBadge variant={statusVariant[inc.status] || 'neutral'}>
                    {statusLabel[inc.status] || inc.status}
                  </StatusBadge>
                </div>
                <h3 className="font-semibold text-card-foreground">{inc.title}</h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {inc.assignedTo?.name || inc.createdBy.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(inc.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                INC-{inc.id.slice(-4).toUpperCase()}
              </span>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            No hay incidentes registrados.
          </div>
        )}
      </div>
    </div>
  )
}
