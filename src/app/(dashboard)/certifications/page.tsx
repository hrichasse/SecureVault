'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Hash,
  Scale,
  FileText,
  X,
  Lock,
  BadgeCheck,
} from 'lucide-react'
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

interface PendingDocument {
  id: string
  name: string
  originalName: string
  confidentialityLevel: string
  createdAt: string
  uploadedBy: { id: string; name: string }
}

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null)

  const [currentRole, setCurrentRole] = useState<string>('')
  const [showCertifyModal, setShowCertifyModal] = useState(false)
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<PendingDocument | null>(null)
  const [notaryLicenseNumber, setNotaryLicenseNumber] = useState('')
  const [signPassword, setSignPassword] = useState('')
  const [certifying, setCertifying] = useState(false)

  const { toast } = useToast()

  async function loadData() {
    setLoading(true)
    try {
      const [certRes, meRes] = await Promise.all([
        fetch('/api/certifications').then(res => res.json()),
        fetch('/api/auth/me').then(res => res.json()),
      ])
      setCertifications(certRes.data || [])
      setCurrentRole(meRes?.data?.role || '')
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar certificaciones.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const canCertify = ['ADMIN', 'ADMIN_COMPANY', 'NOTARY'].includes(currentRole)
  const isNotary = currentRole === 'NOTARY'

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

  const openCertifyModal = async () => {
    setShowCertifyModal(true)
    setSelectedDocument(null)
    setNotaryLicenseNumber('')
    setSignPassword('')
    setLoadingPending(true)

    try {
      const res = await fetch('/api/certifications?pending=true')
      const json = await res.json()
      setPendingDocuments(json.data || [])
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar documentos pendientes.' })
    } finally {
      setLoadingPending(false)
    }
  }

  const submitCertification = async () => {
    if (!selectedDocument) return

    if (isNotary) {
      if (!notaryLicenseNumber.trim() || signPassword.trim().length < 8) {
        toast({
          title: 'Datos incompletos',
          description: 'Ingresa cédula notarial y contraseña de firma (mínimo 8 caracteres).',
          variant: 'destructive',
        })
        return
      }
    }

    setCertifying(true)
    try {
      const res = await fetch('/api/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          notaryLicenseNumber: notaryLicenseNumber.trim() || undefined,
          signPassword: signPassword.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo certificar el documento')

      toast({ title: 'Documento certificado', description: `Codigo: ${json.data.verificationCode}` })
      setShowCertifyModal(false)
      await loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setCertifying(false)
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
          <p className="text-xs sm:text-sm text-muted-foreground">Verificacion y certificacion de documentos</p>
        </div>
        {canCertify && (
          <Button onClick={openCertifyModal} className="gradient-primary text-primary-foreground">
            <Scale className="h-4 w-4 mr-2" />
            Certificar documento
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground text-sm sm:text-base">Verificar documento</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
          Ingrese el codigo de verificacion para validar la autenticidad del documento.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ej: SV-CERT-2024-001 o codigo de verificacion"
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
                    <p className="font-semibold text-success text-sm">Documento valido</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">La certificacion ha sido verificada exitosamente.</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive text-sm">Documento no encontrado</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">No se encontro una certificacion con ese codigo.</p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      <AnimatePresence>
        {showCertifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Scale className="w-6 h-6 text-primary" />
                  Certificar documento
                </h3>
                <button
                  onClick={() => setShowCertifyModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!selectedDocument ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Seleccione un documento pendiente de legalizacion y certificacion.
                  </p>
                  {loadingPending ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : pendingDocuments.length === 0 ? (
                    <div className="p-4 border border-border rounded-lg text-sm text-muted-foreground">
                      No hay documentos pendientes por certificar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDocument(doc)}
                          className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-primary" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{doc.originalName}</p>
                              <p className="text-xs text-muted-foreground">
                                Subido por {doc.uploadedBy.name} · {new Date(doc.createdAt).toLocaleDateString('es-CL')}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground">Documento seleccionado</p>
                    <p className="text-sm font-semibold text-foreground">{selectedDocument.originalName}</p>
                  </div>

                  <div>
                    <label className="label">Numero de cedula notarial</label>
                    <Input
                      value={notaryLicenseNumber}
                      onChange={(e) => setNotaryLicenseNumber(e.target.value)}
                      placeholder="Ej: NOT-2024-00123"
                    />
                  </div>

                  <div>
                    <label className="label">Contrasena de firma electronica</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={signPassword}
                        onChange={(e) => setSignPassword(e.target.value)}
                        className="pl-9"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning-foreground">
                    <BadgeCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p>
                      Aviso legal: Al certificar este documento, usted confirma su autenticidad bajo responsabilidad notarial conforme a la legislacion vigente.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setSelectedDocument(null)} disabled={certifying}>
                      Volver a lista
                    </Button>
                    <Button className="flex-1 gradient-primary text-primary-foreground" onClick={submitCertification} disabled={certifying}>
                      {certifying ? 'Firmando...' : 'Firmar y certificar'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
