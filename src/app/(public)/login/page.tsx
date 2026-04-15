import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'
import { Shield, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Iniciar sesión — SecureVault',
}

export default async function LoginPage() {
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
          <h1 className="text-4xl font-bold text-primary-foreground">SecureVault Control</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Plataforma empresarial para la gestión segura de documentos corporativos
          </p>
          <div className="flex items-center gap-2 justify-center text-primary-foreground/60 text-sm">
            <Lock className="h-4 w-4" />
            <span>Cifrado SHA-256 · Auditoría completa · Certificación digital</span>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SecureVault</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Iniciar sesión</h2>
            <p className="text-muted-foreground text-sm">Accede a tu plataforma de gestión documental segura</p>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            Plataforma segura empresarial · Conexión cifrada
          </p>
        </div>
      </div>
    </div>
  )
}
