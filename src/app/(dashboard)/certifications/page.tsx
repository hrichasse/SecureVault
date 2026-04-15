'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Search, CheckCircle2, XCircle, Hash, Scale, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface Certification {
  id: string
  verificationCode: string
  document: { name: string; company?: { name: string } }
  certifiedBy: { name: string }
  sha256Hash: string
  isValid: boolean
  createdAt: string
}

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/certifications')
      .then(res => res.json())
      .then(data => setCertifications(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleVerify = async () => {
    if (!verifyCode.trim()) return
    try {
      const res = await fetch(`/api/certifications/verify/${verifyCode.trim()}`)
      const data = await res.json()
      setVerifyResult(data.valid ? 'valid' : 'invalid')
    } catch {
      setVerifyResult('invalid')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Certificaciones</h1></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card rounded-xl border border-border animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Certificaciones</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Verificación y certificación de documentos</p>
        </div>
      </div>

      {/* Verification section */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground text-sm sm:text-base">Verificar documento</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
          Ingrese el código de verificación para validar la autenticidad del documento.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ej: SV-CERT-2024-001 o código de verificación"
              value={verifyCode}
              onChange={(e) => { setVerifyCode(e.target.value); setVerifyResult(null) }}
              className="pl-9"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>
          <Button onClick={handleVerify} className="gradient-primary text-primary-foreground">
            <Search className="h-4 w-4 mr-2" />
            Verificar
          </Button>
        </div>
        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg flex items-center gap-3 ${
                verifyResult === 'valid'
                  ? 'bg-success/10 border border-success/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}
            >
              {verifyResult === 'valid' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-success text-sm">✔ Documento válido</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">La certificación ha sido verificada exitosamente.</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive text-sm">✖ Documento no encontrado</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">No se encontró una certificación con ese código.</p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Certifications list */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <h3 className="font-semibold text-card-foreground text-sm sm:text-base">Certificaciones registradas</h3>
          <span className="text-xs text-muted-foreground ml-auto">{certifications.length} registros</span>
        </div>
        <div className="divide-y divide-border">
          {certifications.length === 0 ? (
            <div className="px-4 sm:px-5 py-8 text-center text-xs sm:text-sm text-muted-foreground">
              No hay certificaciones registradas.
            </div>
          ) : (
            certifications.map((cert, i) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-2 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge variant={cert.isValid ? 'success' : 'danger'}>
                    {cert.isValid ? 'Certificado' : 'Revocado'}
                  </StatusBadge>
                  <span className="font-mono text-xs sm:text-sm font-semibold text-card-foreground">
                    {cert.verificationCode}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{cert.document.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{cert.document.company?.name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(cert.createdAt).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate">{cert.sha256Hash}</p>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
