'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import { updateUserNameAction } from './actions'
import { useToast } from '@/hooks/use-toast'

interface UserProfileFormProps {
  dbUser: {
    name: string
    email: string
    role: string
  }
}

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrador del Sistema',
  ADMIN_COMPANY: 'Administrador de Empresa',
  USER: 'Trabajador',
  NOTARY: 'Notario',
}

export function UserProfileForm({ dbUser }: UserProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  async function handleSubmit(formData: FormData) {
    try {
      setIsLoading(true)
      const result = await updateUserNameAction(formData)

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      } else if (result.success) {
        toast({
          title: 'Éxito',
          description: 'Tu nombre ha sido actualizado correctamente',
          variant: 'default',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al guardar los cambios',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
      <h2 className="text-lg font-bold text-card-foreground pb-4 border-b border-border flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Perfil Personal
      </h2>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Nombre Completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={dbUser.name}
            required
            minLength={2}
            maxLength={100}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Correo Electrónico
          </label>
          <p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
            {dbUser.email}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">El email no puede modificarse desde aquí.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Rol en el sistema
          </label>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
            {roleLabel[dbUser.role] || dbUser.role}
          </span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
