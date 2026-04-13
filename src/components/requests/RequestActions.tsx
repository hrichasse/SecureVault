'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RequestActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [grantDurationDays, setGrantDurationDays] = useState('7')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openModal = (type: 'approve' | 'reject') => {
    setAction(type)
    setReviewNote('')
    setGrantDurationDays('7')
    setError(null)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setAction(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!action) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewNote: reviewNote || undefined,
          ...(action === 'approve' && grantDurationDays
            ? { grantDurationDays: parseInt(grantDurationDays, 10) }
            : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error procesando solicitud')

      setIsOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => openModal('approve')}
          className="text-xs bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 px-3 py-1.5 rounded-md font-medium transition-colors"
        >
          Aprobar
        </button>
        <button
          onClick={() => openModal('reject')}
          className="text-xs bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 px-3 py-1.5 rounded-md font-medium transition-colors"
        >
          Rechazar
        </button>
      </div>

      {isOpen && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-4">
              {action === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
            </h3>

            {error && (
              <div className="mb-4 text-sm text-[#ef4444] bg-[#ef4444]/15 p-3 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {action === 'approve' && (
                <div>
                  <label className="label">Duración del acceso (Días)</label>
                  <select
                    value={grantDurationDays}
                    onChange={(e) => setGrantDurationDays(e.target.value)}
                    className="input"
                  >
                    <option value="1">1 día</option>
                    <option value="7">7 días</option>
                    <option value="30">30 días</option>
                    <option value="">Permanente</option>
                  </select>
                </div>
              )}

              <div>
                <label className="label">
                  Nota {action === 'reject' ? '(Requerida)' : '(Opcional)'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  required={action === 'reject'}
                  className="input resize-none"
                  rows={3}
                  placeholder={`Motivo del ${action === 'approve' ? 'acceso' : 'rechazo'}...`}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={action === 'approve' ? 'btn-primary' : 'bg-[#ef4444] hover:bg-[#dc2626] text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors'}
                >
                  {loading ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
