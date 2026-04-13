import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
}

/**
 * Página de login.
 *
 * Al ser un Server Component, puede verificar la sesión antes de renderizar.
 * Si el usuario ya está autenticado → redirige directamente al dashboard.
 */
export default async function LoginPage() {
  // Verificar sesión existente — redirect si ya está logueado
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo + Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#3b82f6] mb-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Bienvenido de vuelta</h1>
          <p className="text-[#94a3b8] text-sm mt-1">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Form card */}
        <div className="card p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
