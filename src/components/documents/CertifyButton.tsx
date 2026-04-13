'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CertifyButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const handleCertify = async () => {
    setLoading(true)
    setError(null)
    setCopiedUrl(null)

    try {
      const res = await fetch('/api/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al certificar documento')

      const verificationUrl = `${window.location.origin}/verify/${json.data.verificationCode}`
      setCopiedUrl(verificationUrl)
      
      // Intentar copiar al portapapeles
      try {
        await navigator.clipboard.writeText(verificationUrl)
      } catch (e) {
        console.error('Error copiando al portapapeles', e)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 w-full">
      <button
        onClick={handleCertify}
        disabled={loading}
        className="btn-secondary w-full text-sm justify-center flex items-center gap-2 border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/15"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {loading ? 'Generando hash...' : 'Certificar Documento'}
      </button>

      {error && <p className="text-xs text-[#ef4444] text-center">{error}</p>}
      
      {copiedUrl && (
        <div className="text-xs text-center p-2 bg-[#10b981]/10 rounded-lg text-[#10b981] break-all border border-[#10b981]/20">
          <p className="font-semibold mb-1">¡Certificación Creada!</p>
          <p>La URL de verificación ha sido copiada.</p>
        </div>
      )}
    </div>
  )
}
