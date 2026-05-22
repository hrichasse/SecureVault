'use client'

import { useState } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction } from '@/modules/auth/actions'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * ForgotPasswordForm — Formulario para solicitar el enlace de restauración de contraseña.
 */
export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await requestPasswordResetAction(formData)

    setLoading(false)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccessMessage(result.message || 'Se ha enviado el correo con éxito.')
    }
  }

  if (successMessage) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-bounce">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">¡Enlace enviado!</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {successMessage}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="w-full">
            <Button className="w-full h-11 gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg animate-shake"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Formulario de email */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="reset-email" className="text-sm font-medium text-foreground">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="usuario@empresa.com"
              className="pl-10"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Te enviaremos un correo con un enlace de un solo uso para restaurar tu contraseña.
          </p>
        </div>

        {/* Submit */}
        <Button
          id="btn-forgot-submit"
          type="submit"
          disabled={loading}
          className="w-full h-11 gradient-primary text-primary-foreground font-semibold flex items-center justify-center"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando enlace...
            </span>
          ) : (
            'Enviar enlace de recuperación'
          )}
        </Button>
      </form>

      {/* Volver al login */}
      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
