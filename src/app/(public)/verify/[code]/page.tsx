'use client'

import { useState, useEffect } from 'react'

interface VerificationData {
  name: string
  sha256Hash: string
  certifiedAt: string
  company: string
}

export default function VerifyPage({ params }: { params: { code: string } }) {
  const [data, setData] = useState<VerificationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Hash comparison
  const [isDragOver, setIsDragOver] = useState(false)
  const [clientHash, setClientHash] = useState<string | null>(null)
  const [isMatch, setIsMatch] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`/api/certifications/verify/${params.code}`)
      .then(res => res.json().then(json => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok || !json.valid) {
          setError(json.message || 'Código inválido o certificación revocada')
        } else {
          setData(json.data)
        }
      })
      .catch(() => setError('Error de red al verificar'))
      .finally(() => setLoading(false))
  }, [params.code])

  const calculateHash = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      setClientHash(hashHex)
      setIsMatch(hashHex === data?.sha256Hash)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.[0]) calculateHash(e.dataTransfer.files[0])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3b82f6] mb-2 shadow-lg shadow-[#3b82f6]/20">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Verificación Pública</h1>
          <p className="text-[#94a3b8] text-sm">Validación criptográfica de existencia de documento</p>
        </div>

        {error ? (
          <div className="card p-6 bg-[#ef4444]/10 border-[#ef4444]/30">
            <div className="flex flex-col items-center text-center gap-3">
              <svg className="w-10 h-10 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-bold text-[#ef4444]">Certificación Inválida</h2>
              <p className="text-[#e2e8f0] text-sm">{error}</p>
            </div>
          </div>
        ) : data ? (
          <div className="card p-6 border-[#10b981]/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/15 text-[#10b981] px-2.5 py-1 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                Verificado Autorizado
              </span>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white pr-24">{data.name}</h2>
              
              <div className="space-y-3 pt-4 border-t border-[#334155]/60">
                <div>
                  <span className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Empresa Certificadora</span>
                  <span className="text-[#e2e8f0]">{data.company}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Fecha de Certificación (Proof of Existence)</span>
                  <span className="text-[#e2e8f0]">
                    {new Date(data.certifiedAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'long' })}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Firma Criptográfica (SHA-256)</span>
                  <span className="text-[#3b82f6] font-mono text-sm break-all bg-[#0f172a] p-2 rounded-lg block border border-[#1e293b]">
                    {data.sha256Hash}
                  </span>
                </div>
              </div>
            </div>

            {/* Checker Tool */}
            <div className="mt-8 pt-6 border-t border-[#334155]/60">
              <h3 className="text-sm font-semibold text-[#e2e8f0] mb-3">¿Tienes el archivo original? Verifica su integridad localmente:</h3>
              
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200
                  ${isDragOver 
                    ? 'border-[#3b82f6] bg-[#3b82f6]/5' 
                    : 'border-[#334155] hover:border-[#475569] hover:bg-[#1e293b]/50'
                  }`}
              >
                {!clientHash ? (
                   <div className="flex flex-col items-center gap-2">
                     <svg className="w-8 h-8 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                     <p className="text-sm text-[#94a3b8]">Arrastra el PDF aquí para verificar su hash localmente (no sube a internet)</p>
                   </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    {isMatch ? (
                      <div className="w-12 h-12 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#ef4444]/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    
                    <h4 className={`font-bold ${isMatch ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {isMatch ? '¡Archivo Idéntico!' : 'El archivo NO COINCIDE (Alterado)'}
                    </h4>
                    
                    <button onClick={() => { setClientHash(null); setIsMatch(null) }} className="text-xs text-[#94a3b8] hover:text-white underline">
                      Verificar otro archivo
                    </button>
                  </div>
                )}
                
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) calculateHash(file)
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
