'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IncidentStatus } from '@/types'

interface IncidentActionPanelProps {
  incidentId: string
  currentStatus: IncidentStatus
  assignedToId?: string | null
  users: { id: string; name: string }[]
}

export function IncidentActionPanel({
  incidentId,
  currentStatus,
  assignedToId,
  users,
}: IncidentActionPanelProps) {
  const router = useRouter()
  const [status, setStatus] = useState<IncidentStatus>(currentStatus)
  const [assignee, setAssignee] = useState(assignedToId || '')
  const [resolution, setResolution] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          assignedToId: assignee === '' ? null : assignee,
          ...(status === 'RESOLVED' || status === 'CLOSED' ? { resolution } : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar incidente')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#e2e8f0] mb-2">Gestión del Incidente</h2>
      
      {error && (
        <div className="text-xs text-[#ef4444] bg-[#ef4444]/15 p-2.5 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="label">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as IncidentStatus)}
          className="input"
        >
          <option value="OPEN">Abierto</option>
          <option value="IN_PROGRESS">En curso</option>
          <option value="RESOLVED">Resuelto</option>
          <option value="CLOSED">Cerrado</option>
        </select>
      </div>

      <div>
        <label className="label">Asignado a</label>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="input"
        >
          <option value="">-- Sin asignar --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {(status === 'RESOLVED' || status === 'CLOSED') && (
        <div>
          <label className="label">Resolución / Nota de cierre</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            required
            className="input resize-none"
            rows={3}
            placeholder="Describe cómo se resolvió el incidente..."
          />
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
        {loading ? 'Actualizando...' : 'Guardar Cambios'}
      </button>
    </form>
  )
}
