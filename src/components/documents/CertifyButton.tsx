'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Scale, X, BadgeCheck } from 'lucide-react'

export function CertifyButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const [notaryLicenseNumber, setNotaryLicenseNumber] = useState('')
  const [signPassword, setSignPassword] = useState('')
  const [observations, setObservations] = useState('')

  const handleCertify = async () => {
    if (!notaryLicenseNumber.trim() || signPassword.trim().length < 8) {
      setError('Ingresa cédula notarial y contraseña de firma (mínimo 8 caracteres).')
      return
    }

    setLoading(true)
    setError(null)
    setCopiedUrl(null)

    try {
      const res = await fetch('/api/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          notaryLicenseNumber: notaryLicenseNumber.trim(),
          signPassword: signPassword.trim(),
          observations: observations.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al certificar documento')

      const verificationUrl = `${window.location.origin}/verify/${json.data.verificationCode}`
      setCopiedUrl(verificationUrl)
      
      try {
        await navigator.clipboard.writeText(verificationUrl)
      } catch (e) {
        console.error('Error copiando al portapapeles', e)
      }

      router.refresh()
      
      // Close modal after 3 seconds of success
      setTimeout(() => {
        setIsOpen(false)
        setCopiedUrl(null)
        setNotaryLicenseNumber('')
        setSignPassword('')
        setObservations('')
      }, 3000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary w-full text-sm justify-center flex items-center gap-2 border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/15"
      >
        <Scale className="w-4 h-4" />
        Certificar Documento
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 space-y-4 relative shadow-2xl border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#10b981]" />
                Certificar documento
              </h3>
              <button
                onClick={() => !loading && setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {copiedUrl ? (
              <div className="text-sm text-center p-4 bg-[#10b981]/10 rounded-lg text-[#10b981] break-all border border-[#10b981]/20">
                <BadgeCheck className="w-12 h-12 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-lg mb-1">¡Certificación Creada!</p>
                <p className="text-foreground/80 mb-2">El documento ha sido firmado legalmente.</p>
                <p className="text-xs opacity-70">La URL de verificación ha sido copiada al portapapeles.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Número de cédula notarial
                  </label>
                  <input
                    type="text"
                    value={notaryLicenseNumber}
                    onChange={(e) => setNotaryLicenseNumber(e.target.value)}
                    placeholder="Ej: NOT-2024-00123"
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Contraseña de firma (tu clave)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={signPassword}
                      onChange={(e) => setSignPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Observaciones legales (Opcional)
                  </label>
                  <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Certifico la integridad de este documento..."
                    className="w-full min-h-[80px] bg-background border border-input rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {error && <p className="text-xs text-[#ef4444]">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCertify}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium bg-[#10b981] hover:bg-[#059669] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? 'Firmando...' : 'Firmar y certificar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
