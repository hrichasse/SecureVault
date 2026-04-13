import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { findDocumentById } from '@/modules/documents/document.repository'
import { hasActivePermission } from '@/modules/access-requests/request.service'
import { ConfidentialityBadge } from '@/components/documents/ConfidentialityBadge'
import { RequestAccessButton } from '@/components/documents/RequestAccessButton'
import { ReportIncidentButton } from '@/components/incidents/ReportIncidentButton'
import { CertifyButton } from '@/components/documents/CertifyButton'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'Detalle del documento' }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Meta { label: string; value: string }

function MetaRow({ label, value }: Meta) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#334155]/60 last:border-0">
      <span className="text-sm text-[#64748b] min-w-[140px]">{label}</span>
      <span className="text-sm text-[#e2e8f0] text-right font-mono break-all">{value}</span>
    </div>
  )
}

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  // Auth check
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, role: true },
  })
  if (!dbUser) redirect('/login')

  const document = await findDocumentById(params.id, dbUser.companyId)
  if (!document) notFound()

  const hasAccess = await hasActivePermission(params.id, dbUser.id, dbUser.role as UserRole)

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-8">
      {/* Back */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#e2e8f0] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a documentos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#e2e8f0]">{document.name}</h1>
            <p className="text-sm text-[#64748b] mt-0.5">{document.originalName}</p>
            {document.description && (
              <p className="text-sm text-[#94a3b8] mt-2 leading-relaxed max-w-xl">
                {document.description}
              </p>
            )}
          </div>
        </div>
        <ConfidentialityBadge level={document.confidentialityLevel} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Metadata ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-4">Información del archivo</h2>
            <div>
              <MetaRow label="Nombre original" value={document.originalName} />
              <MetaRow label="Tamaño" value={formatBytes(document.sizeBytes)} />
              <MetaRow label="Tipo MIME" value={document.mimeType} />
              <MetaRow label="SHA-256" value={`${document.sha256Hash.slice(0, 16)}...`} />
              <MetaRow label="Storage path" value={document.storagePath} />
              <MetaRow label="Subido por" value={document.uploadedBy.name} />
              <MetaRow label="Fecha de subida" value={formatDate(document.createdAt)} />
            </div>
          </div>

          {/* Audit log preview */}
          {'_count' in document && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-[#e2e8f0] mb-4">Estadísticas</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Solicitudes de acceso', value: (document as { _count: { accessRequests: number } })._count.accessRequests },
                  { label: 'Certificaciones', value: (document as { _count: { certifications: number } })._count.certifications },
                  { label: 'Registros de auditoría', value: (document as { _count: { auditLogs: number } })._count.auditLogs },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 bg-[#0f172a] rounded-lg">
                    <p className="text-2xl font-bold text-[#3b82f6]">{stat.value}</p>
                    <p className="text-xs text-[#64748b] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <div className="space-y-4">
          {/* Classification */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#e2e8f0]">Clasificación</h2>
            <ConfidentialityBadge level={document.confidentialityLevel} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748b]">Score</span>
              <span className="text-[#e2e8f0] font-mono">{document.classificationScore}</span>
            </div>
            <div className="w-full bg-[#334155] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] transition-all"
                style={{ width: `${Math.min((document.classificationScore / 12) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-3">Acciones</h2>
            {hasAccess ? (
              <a href={`/api/documents/${document.id}/download`} className="btn-primary w-full text-sm justify-center flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Descargar Documento
              </a>
            ) : (
              <RequestAccessButton documentId={document.id} />
            )}
            
            {['ADMIN', 'REVIEWER'].includes(dbUser.role) && (
              <div className="pt-2">
                <CertifyButton documentId={document.id} />
              </div>
            )}

            <div className="pt-2">
              <p className="text-xs text-[#64748b] text-center">
                {hasAccess ? 'Tienes acceso autorizado o eres administrador.' : 'No tienes acceso a este documento.'}
              </p>
            </div>
          </div>

          {/* Incidentes */}
          <div className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-3">Incidentes</h2>
            <Link href={`/incidents?documentId=${document.id}`} className="btn-secondary w-full text-sm justify-center mb-2">
              Ver incidentes
            </Link>
            <ReportIncidentButton documentId={document.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
