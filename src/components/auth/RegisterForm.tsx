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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setLoading(false)
      return
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

      <div className="space-y-2">
        <Label htmlFor="reg-name">Nombre completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="reg-name" name="name" type="text" autoComplete="name" required minLength={2} placeholder="Juan García" className="pl-10" disabled={loading} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-company">Nombre de la empresa</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="reg-company" name="companyName" type="text" autoComplete="organization" required minLength={2} placeholder="Acme Corp" className="pl-10" disabled={loading} />
        </div>
      </div>

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
