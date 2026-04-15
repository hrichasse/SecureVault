'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/modules/auth/actions'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * LoginForm — formulario de inicio de sesión con diseño Lovable.
 *
 * Llama al Server Action loginAction() directamente.
 * En éxito: Next.js navega automáticamente a /dashboard.
 * En error: muestra el mensaje sin recargar.
 */
export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)

    // Si loginAction llama redirect(), esta línea no se ejecuta
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-sm font-medium text-foreground">Correo electrónico</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="usuario@empresa.com"
            className="pl-10"
            disabled={loading}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-sm font-medium text-foreground">Contraseña</Label>
          <a
            href="#"
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pl-10 pr-10"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Submit */}
      <Button
        id="btn-login-submit"
        type="submit"
        disabled={loading}
        className="w-full h-11 gradient-primary text-primary-foreground font-semibold"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Iniciando sesión...
          </span>
        ) : (
          'Acceder a SecureVault'
        )}
      </Button>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Regístrate gratis
        </Link>
      </p>
    </form>
  )
}
