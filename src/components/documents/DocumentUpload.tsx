'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ConfidentialityBadge, ConfidentialitySelector } from './ConfidentialityBadge'
import type { ConfidentialityLevel } from '@/types'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface ClassificationPreview {
  level: ConfidentialityLevel
  score: number
  matchedTerms: string[]
}

interface UploadResult {
  id: string
  name: string
  confidentialityLevel: ConfidentialityLevel
  classificationScore: number
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function DocumentUpload({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<ClassificationPreview | null>(null)
  const [overrideLevel, setOverrideLevel] = useState<ConfidentialityLevel | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Pre-clasificar al seleccionar archivo
  const classifyPreview = async (f: File, desc?: string) => {
    try {
      const res = await fetch('/api/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.name, description: desc }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setPreview(data)
        setOverrideLevel(data.level)
      }
    } catch {
      // No fatal — classification preview is optional
    }
  }

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('El archivo no puede superar 10MB')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
    setStatus('idle')
    classifyPreview(f)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
    if (file) classifyPreview(file, e.target.value)
  }

  const handleSubmit = async () => {
    if (!file) return
    setStatus('uploading')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    if (overrideLevel) formData.append('confidentialityLevel', overrideLevel)

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al subir el documento')

      setResult(json.data)
      setStatus('success')
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }

  const reset = () => {
    setFile(null)
    setDescription('')
    setPreview(null)
    setOverrideLevel(null)
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  // ── Success state ────────────────────────────────────────
  if (status === 'success' && result) {
    return (
      <div className="card p-6 text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-[#e2e8f0] font-semibold">Documento subido exitosamente</p>
          <p className="text-sm text-[#94a3b8] mt-1 truncate">{result.name}</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-[#94a3b8]">Clasificado como:</span>
          <ConfidentialityBadge level={result.confidentialityLevel} />
        </div>
        <button onClick={reset} className="btn-secondary text-sm mx-auto">
          Subir otro documento
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm px-4 py-3 rounded-lg">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
          ${isDragOver
            ? 'border-[#3b82f6] bg-[#3b82f6]/5'
            : file
            ? 'border-[#10b981]/50 bg-[#10b981]/5'
            : 'border-[#334155] hover:border-[#475569] hover:bg-[#334155]/20'
          }`}
        onClick={() => !file && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileInput}
        />

        {file ? (
          /* File selected */
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/25 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#e2e8f0] truncate max-w-[240px]">{file.name}</p>
              <p className="text-xs text-[#64748b] mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="text-xs text-[#64748b] hover:text-[#ef4444] transition-colors"
            >
              Cambiar archivo
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#334155]/60 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#e2e8f0]">
                Arrastra un PDF aquí o{' '}
                <span className="text-[#3b82f6]">selecciona un archivo</span>
              </p>
              <p className="text-xs text-[#64748b] mt-1">Solo PDF · Máx. 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="label" htmlFor="doc-description">
          Descripción <span className="text-[#475569] font-normal">(opcional)</span>
        </label>
        <textarea
          id="doc-description"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Describe brevemente el contenido del documento..."
          rows={2}
          className="input resize-none"
          disabled={status === 'uploading'}
        />
      </div>

      {/* Classification preview */}
      {preview && file && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
              Clasificación automática
            </p>
            <div className="flex items-center gap-2">
              <ConfidentialityBadge level={preview.level} />
              <span className="text-xs text-[#475569]">score: {preview.score}</span>
            </div>
          </div>

          {preview.matchedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preview.matchedTerms.map((term) => (
                <span
                  key={term}
                  className="text-xs bg-[#334155]/60 text-[#94a3b8] px-2 py-0.5 rounded"
                >
                  {term}
                </span>
              ))}
            </div>
          )}

          {/* Manual override */}
          <div>
            <p className="text-xs text-[#64748b] mb-2">
              ¿El nivel no es correcto? Corrígelo:
            </p>
            {overrideLevel && (
              <ConfidentialitySelector
                value={overrideLevel}
                onChange={setOverrideLevel}
                disabled={status === 'uploading'}
              />
            )}
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        disabled={!file || status === 'uploading'}
        onClick={handleSubmit}
        className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {status === 'uploading' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analizando confidencialidad...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Subir documento
          </span>
        )}
      </button>
    </div>
  )
}
