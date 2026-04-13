import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { listDocuments } from '@/modules/documents/document.repository'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { DocumentUpload } from '@/components/documents/DocumentUpload'
import { ConfidentialityBadge } from '@/components/documents/ConfidentialityBadge'
import type { ConfidentialityLevel, DocumentStatus } from '@/types'

export const metadata: Metadata = { title: 'Documentos' }

interface PageProps {
  searchParams: {
    level?: string
    status?: string
    page?: string
  }
}

const LEVELS: ConfidentialityLevel[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']

export default async function DocumentsPage({ searchParams }: PageProps) {
  // Auth check
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, name: true },
  })
  if (!dbUser) redirect('/login')

  const level = (searchParams.level as ConfidentialityLevel) || undefined
  const status = (searchParams.status as DocumentStatus) || undefined
  const page = parseInt(searchParams.page ?? '1', 10)

  const { documents, total, totalPages, hasNext, hasPrev } = await listDocuments({
    companyId: dbUser.companyId,
    confidentialityLevel: level,
    status,
    page,
    limit: 12,
  })

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title text-2xl">Documentos</h1>
          <p className="page-subtitle">
            {total} documento{total !== 1 ? 's' : ''} en tu empresa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Upload panel (izquierda) ── */}
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Subir documento
            </h2>
            <DocumentUpload />
          </div>
        </div>

        {/* ── Document list (derecha) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[#64748b] font-medium">Filtrar:</span>
            <a
              href="/documents"
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !level ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
              }`}
            >
              Todos
            </a>
            {LEVELS.map((l) => (
              <a
                key={l}
                href={`/documents?level=${l}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  level === l ? 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#3b82f6]' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'
                }`}
              >
                {l}
              </a>
            ))}
          </div>

          {/* Document grid */}
          {documents.length === 0 ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <svg className="w-12 h-12 text-[#334155] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-[#64748b] text-sm font-medium">
                {level ? `No hay documentos con nivel ${level}` : 'No hay documentos todavía'}
              </p>
              <p className="text-[#475569] text-xs mt-1">
                Sube tu primer documento usando el panel de la izquierda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  id={doc.id}
                  name={doc.name}
                  originalName={doc.originalName}
                  confidentialityLevel={doc.confidentialityLevel}
                  sizeBytes={doc.sizeBytes}
                  mimeType={doc.mimeType}
                  createdAt={doc.createdAt}
                  uploadedBy={doc.uploadedBy}
                  description={doc.description}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#64748b]">
                Página {page} de {totalPages} · {total} documentos
              </p>
              <div className="flex gap-2">
                {hasPrev && (
                  <a
                    href={`/documents?page=${page - 1}${level ? `&level=${level}` : ''}`}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ← Anterior
                  </a>
                )}
                {hasNext && (
                  <a
                    href={`/documents?page=${page + 1}${level ? `&level=${level}` : ''}`}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Siguiente →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
