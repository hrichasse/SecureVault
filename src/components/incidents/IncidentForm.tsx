'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IncidentType } from '@/types'

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'ACCESS_DENIED', label: 'Acceso Denegado' },
  { value: 'DOCUMENT_LOST', label: 'Documento Perdido' },
  { value: 'DATA_BREACH', label: 'Filtración de Datos' },
  { value: 'PERMISSION_EXPIRED', label: 'Permiso Expirado' },
  { value: 'INTEGRITY_FAILURE', label: 'Fallo de Integridad' },
  { value: 'CLASSIFICATION_ERROR', label: 'Error de Clasificación' },
  { value: 'OTHER', label: 'Otro' },
]

export function IncidentForm({ documentId, onSuccess, onCancel }: { documentId?: string, onSuccess?: () => void, onCancel?: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IncidentType>('OTHER')
  const [priority, setPriority] = useState('MEDIUM')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          type,
          documentId,
          // Si hay documentId, el backend ignorará nuestra prioridad extra
          ...(!documentId && { priority }),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear incidente')

      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-[#ef4444] bg-[#ef4444]/15 p-3 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="label">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={5}
          className="input"
          placeholder="Resumen del problema..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tipo de incidente</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IncidentType)}
            className="input"
          >
            {INCIDENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {!documentId && (
          <div>
            <label className="label">Prioridad inicial</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="input"
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="label">Descripción detallada</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          className="input resize-none"
          rows={4}
          placeholder="Describe el problema en detalle, pasos para reproducir o evidencia adicional..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[#334155]/60 mt-6">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
          {loading ? 'Creando...' : 'Crear Incidente'}
        </button>
      </div>
    </form>
  )
}
