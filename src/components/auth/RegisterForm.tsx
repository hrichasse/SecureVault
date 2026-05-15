'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/modules/auth/actions'
import { User, Building2, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * RegisterForm — formulario de registro de empresa y usuario.
 *
 * Campos: nombre, nombre de empresa, email, password.
 * Llama al Server Action registerAction() directamente.
 */
export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'ADMIN_COMPANY' | 'NOTARY'>('ADMIN_COMPANY')

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    try {
      // Mantener el flujo OAuth en el servidor para que el code_verifier
      // (PKCE) quede en cookie y pueda intercambiarse en /api/auth/callback.
      window.location.href = '/api/auth/google'
    } catch {
      setError('No se pudo iniciar el registro con Google.')
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const role = (formData.get('role') as string) || 'ADMIN_COMPANY'

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setLoading(false)
      return
    }

    if (role === 'ADMIN_COMPANY') {
      const companyName = (formData.get('companyName') as string || '').trim()
      const companyRut = (formData.get('companyRut') as string || '').trim()
      const companyAddress = (formData.get('companyAddress') as string || '').trim()
      const companyBusinessLine = (formData.get('companyBusinessLine') as string || '').trim()

      if (!companyName || !companyRut || !companyAddress || !companyBusinessLine) {
        setError('Para Administrador de Empresa debes completar todos los datos de empresa.')
        setLoading(false)
        return
      }
    }

    const result = await registerAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
          <span>{error}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground disabled:opacity-50 disabled:pointer-events-none"
      >
        {googleLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        {googleLoading ? 'Redirigiendo...' : 'Registrarse con Google'}
      </button>

      {/* Separador */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">o regístrate con email</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-name">Nombre completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="reg-name" name="name" type="text" autoComplete="name" required minLength={2} placeholder="Juan García" className="pl-10" disabled={loading} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-role">Tipo de cuenta</Label>
        <select
          id="reg-role"
          name="role"
          className="input"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as 'ADMIN_COMPANY' | 'NOTARY')}
          disabled={loading}
        >
          <option value="ADMIN_COMPANY">Administrador de Empresa</option>
          <option value="NOTARY">Notario / Certificador</option>
        </select>
      </div>

      {selectedRole === 'ADMIN_COMPANY' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="reg-company">Nombre de la empresa</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="reg-company" name="companyName" type="text" autoComplete="organization" required minLength={2} placeholder="Acme Corp" className="pl-10" disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-rut">RUT empresa</Label>
            <Input id="reg-company-rut" name="companyRut" type="text" required placeholder="12.345.678-9" className="input" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-address">Dirección</Label>
            <Input id="reg-company-address" name="companyAddress" type="text" required placeholder="Av. Providencia 1234" className="input" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-business">Giro</Label>
            <Input id="reg-company-business" name="companyBusinessLine" type="text" required placeholder="Logística y transporte" className="input" disabled={loading} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="reg-email">Correo electrónico</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="reg-email" name="email" type="email" autoComplete="email" required placeholder="tu@empresa.com" className="pl-10" disabled={loading} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">Contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo 8 caracteres" className="pl-10" disabled={loading} />
        </div>
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id="reg-terms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          disabled={loading}
        />
        <label htmlFor="reg-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
          Acepto los{' '}<a href="#" className="text-primary hover:underline">términos de servicio</a>{' '}y la{' '}<a href="#" className="text-primary hover:underline">política de privacidad</a>
        </label>
      </div>

      <Button id="btn-register-submit" type="submit" disabled={loading} className="w-full h-11 gradient-primary text-primary-foreground font-semibold">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creando cuenta...
          </span>
        ) : 'Crear cuenta'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
          Inicia sesión
        </Link>
      </p>
    </form>
  )
}
