'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RequestAccessButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('7')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          reason,
          requestedDurationDays: parseInt(duration, 10),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al solicitar acceso')

      setSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-secondary w-full text-sm justify-center">
        Solicitar acceso
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-4">Solicitar Acceso</h3>
            
            {success ? (
              <div className="bg-[#10b981]/15 text-[#10b981] p-4 rounded-lg text-center font-medium">
                ¡Solicitud enviada exitosamente!
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="text-sm text-[#ef4444] bg-[#ef4444]/15 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <div>
                  <label className="label">Motivo de la solicitud</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    minLength={10}
                    className="input resize-none"
                    rows={3}
                    placeholder="Necesito revisar este documento para..."
                  />
                  <p className="text-xs text-[#64748b] mt-1">Mínimo 10 caracteres.</p>
                </div>

                <div>
                  <label className="label">Tiempo requerido</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="input"
                  >
                    <option value="1">1 día</option>
                    <option value="7">1 semana</option>
                    <option value="30">1 mes</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary" disabled={loading}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm">
                    {loading ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
