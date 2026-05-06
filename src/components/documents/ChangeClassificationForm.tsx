'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { ConfidentialityLevel } from '@/types'

const LEVELS: ConfidentialityLevel[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']

interface Props {
  documentId: string
  currentLevel: ConfidentialityLevel
  disabled?: boolean
}

export function ChangeClassificationForm({ documentId, currentLevel, disabled }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const handleLevelChange = async (newLevel: string) => {
    if (newLevel === currentLevel) return
    
    if (!confirm(`¿Estás seguro de que deseas cambiar la clasificación a ${newLevel}?`)) {
      return
    }

    setIsUpdating(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidentialityLevel: newLevel }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al actualizar clasificación')
      }

      toast.success('Clasificación actualizada exitosamente')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar clasificación')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="mt-4 border-t border-[#334155]/60 pt-4">
      <label className="text-xs font-medium text-[#94a3b8] mb-2 block">
        Modificar clasificación manual
      </label>
      <div className="relative">
        <select
          value={currentLevel}
          onChange={(e) => handleLevelChange(e.target.value)}
          disabled={disabled || isUpdating}
          className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 disabled:opacity-50 appearance-none cursor-pointer"
        >
          {LEVELS.map(level => (
            <option key={level} value={level}>Nivel: {level}</option>
          ))}
        </select>
        {isUpdating && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" />
          </div>
        )}
      </div>
    </div>
  )
}
