import Link from 'next/link'
import { ConfidentialityBadge } from './ConfidentialityBadge'

interface DocumentCardProps {
  id: string
  name: string
  originalName: string
  confidentialityLevel: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  sizeBytes: number
  mimeType: string
  createdAt: Date | string
  uploadedBy?: { name: string; email: string }
  description?: string | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function DocumentCard({
  id,
  name,
  originalName,
  confidentialityLevel,
  sizeBytes,
  createdAt,
  uploadedBy,
  description,
}: DocumentCardProps) {
  return (
    <Link
      href={`/documents/${id}`}
      className="card p-5 flex flex-col gap-3 hover:border-[#475569] transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        {/* File icon */}
        <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#3b82f6]/15 transition-colors">
          <svg
            className="w-5 h-5 text-[#3b82f6]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>

        <ConfidentialityBadge level={confidentialityLevel} />
      </div>

      {/* Name */}
      <div>
        <h3 className="text-sm font-semibold text-[#e2e8f0] truncate group-hover:text-white transition-colors">
          {name}
        </h3>
        {description && (
          <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-[#64748b] pt-1 border-t border-[#334155]/60">
        <span>{formatBytes(sizeBytes)}</span>
        <span>{formatDate(createdAt)}</span>
      </div>

      {/* Uploader */}
      {uploadedBy && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <div className="w-4 h-4 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
            <span className="text-[8px] text-[#3b82f6] font-bold">
              {uploadedBy.name[0]?.toUpperCase()}
            </span>
          </div>
          <span className="truncate">{uploadedBy.name}</span>
        </div>
      )}
    </Link>
  )
}
