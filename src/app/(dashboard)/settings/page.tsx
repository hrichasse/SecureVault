import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Building2, Info } from 'lucide-react'
import { UserProfileForm } from './UserProfileForm'

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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestiona los datos de tu cuenta y organización</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Info */}
        <UserProfileForm dbUser={{
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
        }} />

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
