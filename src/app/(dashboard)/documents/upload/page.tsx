import type { Metadata } from 'next'
import { DocumentUpload } from '@/components/documents/DocumentUpload'

export const metadata: Metadata = { title: 'Subir documento' }

export default function DocumentUploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subir documento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carga un PDF al vault. El sistema clasificará su nivel de confidencialidad automáticamente.
        </p>
      </div>
      <DocumentUpload />
    </div>
  )
}
