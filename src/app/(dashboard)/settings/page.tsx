import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { updateUserNameAction } from './actions'
import { User, Building2, Info } from 'lucide-react'

export const metadata: Metadata = { title: 'Configuración | SecureVault AI' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { company: true },
  })
  if (!dbUser) redirect('/login')

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrador', REVIEWER: 'Revisor', USER: 'Usuario', NOTARY: 'Notario',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestiona los datos de tu cuenta y organización</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Info */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
          <h2 className="text-lg font-bold text-card-foreground pb-4 border-b border-border flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Perfil Personal
          </h2>

          <form action={updateUserNameAction as unknown as (formData: FormData) => void} className="space-y-4">
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
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
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
              className="w-full h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity mt-2"
            >
              Guardar cambios
            </button>
          </form>
        </div>

        {/* Company Info */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
          <h2 className="text-lg font-bold text-card-foreground pb-4 border-b border-border flex items-center gap-2">
            <Building2 className="w-5 h-5 text-warning" />
            Organización
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nombre de la Empresa</label>
              <p className="text-sm text-card-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
                {dbUser.company.name}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contacto Organizacional</label>
              <p className="text-sm text-card-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
                {dbUser.company.email}
              </p>
            </div>
            {dbUser.company.description && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descripción</label>
                <p className="text-sm text-card-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
                  {dbUser.company.description}
                </p>
              </div>
            )}
            
            <div className="pt-4 text-xs text-muted-foreground flex items-center gap-1.5 border-t border-border mt-4">
              <Info className="w-4 h-4" />
              Para modificar datos de la empresa contáctate con soporte en info@securevault.ai
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
