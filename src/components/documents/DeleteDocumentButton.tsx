'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento de forma permanente? Esta acción no se puede deshacer.')) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al eliminar el documento')
      }

      toast.success('Documento eliminado exitosamente')
      router.push('/documents')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el documento')
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border border-red-500/20 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDeleting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      {isDeleting ? 'Eliminando...' : 'Eliminar Documento'}
    </button>
  )
}
