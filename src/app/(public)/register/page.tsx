import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { Shield, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Crear cuenta — SecureVault',
}

export default async function RegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — gradient hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-primary-foreground/20"
              style={{
                width: `${200 + i * 120}px`,
                height: `${200 + i * 120}px`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground">Crea tu acceso seguro</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Registra Administrador del Sistema, Administrador de Empresa o Notario y comienza a operar en SecureVault
          </p>
        </div>
      </div>

      {/* Right panel — register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SecureVault</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Registro de acceso</h2>
            <p className="text-muted-foreground text-sm">
              Selecciona tu tipo de cuenta. Si eliges Administrador de Empresa, deberás completar los datos legales de la empresa.
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border border-border">
            <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <span>Los trabajadores (USER) son creados por el Administrador de Empresa desde Gestión de Equipo.</span>
          </div>

          <RegisterForm />

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            Plataforma segura empresarial · Conexión cifrada
          </p>
        </div>
      </div>
    </div>
  )
}
