import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Subir documento' }

export default function DocumentUploadPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subir documento</h1>
        <p className="text-slate-400 mt-1">Carga un nuevo documento al vault</p>
      </div>

      {/* TODO: Add DocumentUploadForm with drag-and-drop, classification selection */}
      <div className="glass-card p-12 border-2 border-dashed border-vault-border text-center text-slate-500 text-sm">
        El formulario de carga se implementará en el siguiente prompt.
      </div>
    </div>
  )
}
