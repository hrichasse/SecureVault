'use client'

import { useEffect, useState } from 'react'
import { Send, Check, X, Clock, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface AccessRequest {
  id: string
  requestedBy: { name: string; email: string; company?: { name: string } }
  document: { name: string }
  reason: string
  status: string
  createdAt: string
}

const statusVariant: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral',
}
const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado',
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/access-requests')
      .then(res => res.json())
      .then(data => setRequests(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r))
        toast({
          title: action === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada',
          description: `La solicitud ha sido ${action === 'APPROVED' ? 'aprobada' : 'rechazada'} exitosamente.`,
        })
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Error', description: 'No se pudo procesar la solicitud.' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Solicitudes de Acceso</h1></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Solicitudes de Acceso</h1>
        <p className="text-sm text-muted-foreground">Gestión de solicitudes de acceso a documentos</p>
      </div>

      <div className="space-y-3">
        {requests.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-elevated transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-card-foreground">{req.requestedBy.name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {req.requestedBy.company?.name || 'N/A'}
                  </span>
                  <StatusBadge variant={statusVariant[req.status] || 'neutral'}>
                    {statusLabel[req.status] || req.status}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Solicita acceso a <span className="font-medium text-card-foreground">{req.document.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">{req.reason}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(req.createdAt).toLocaleDateString('es-CL')}
                </p>
              </div>
              <div className="flex gap-2">
                {req.status === 'PENDING' && (
                  <>
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleAction(req.id, 'APPROVED')}>
                      <Check className="h-4 w-4 mr-1" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleAction(req.id, 'REJECTED')}>
                      <X className="h-4 w-4 mr-1" /> Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {requests.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            No hay solicitudes de acceso.
          </div>
        )}
      </div>
    </div>
  )
}
