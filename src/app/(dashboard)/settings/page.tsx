import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: {
      company: true,
    },
  })
  if (!dbUser) redirect('/login')

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="page-title text-2xl">Configuración</h1>
        <p className="page-subtitle">Gestiona los datos de tu cuenta y organización</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Info */}
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-bold text-[#e2e8f0] pb-4 border-b border-[#334155]/60 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Perfil Personal
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Nombre Completo</label>
              <p className="text-sm text-[#e2e8f0] bg-[#1e293b]/50 px-3 py-2 rounded border border-[#334155]/60">
                {dbUser.name}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Correo Electrónico</label>
              <p className="text-sm text-[#e2e8f0] bg-[#1e293b]/50 px-3 py-2 rounded border border-[#334155]/60 text-[#94a3b8]">
                {dbUser.email}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Rol en el sistema</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30">
                {dbUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-bold text-[#e2e8f0] pb-4 border-b border-[#334155]/60 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            Organización
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Nombre de la Empresa</label>
              <p className="text-sm text-[#e2e8f0] bg-[#1e293b]/50 px-3 py-2 rounded border border-[#334155]/60">
                {dbUser.company.name}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Contacto Organizacional</label>
              <p className="text-sm text-[#e2e8f0] bg-[#1e293b]/50 px-3 py-2 rounded border border-[#334155]/60">
                {dbUser.company.email}
              </p>
            </div>
            {dbUser.company.description && (
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Descripción</label>
                <p className="text-sm text-[#e2e8f0] bg-[#1e293b]/50 px-3 py-2 rounded border border-[#334155]/60">
                  {dbUser.company.description}
                </p>
              </div>
            )}
            
            <div className="pt-4 text-xs text-[#64748b] flex items-center gap-1.5 border-t border-[#334155]/60 mt-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              Para modificar estos datos por favor contacta al administrador principal en info@securevault.ai
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
