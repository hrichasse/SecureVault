'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetPasswordAction } from '@/modules/auth/actions'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * ResetPasswordForm — Formulario para restablecer la contraseña.
 */
export function ResetPasswordForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await resetPasswordAction(formData)

    setLoading(false)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(true)
      // Redirigir al dashboard después de 2.5 segundos para mostrar el estado de éxito
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2500)
    }
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-bounce">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">¡Contraseña restablecida!</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu contraseña ha sido actualizada con éxito. Iniciando sesión de forma segura...
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
          className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Nueva Contraseña */}
        <div className="space-y-2">
          <Label htmlFor="reset-password-input" className="text-sm font-medium text-foreground">
            Nueva contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-password-input"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Mínimo 8 caracteres"
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

        {/* Confirmar Contraseña */}
        <div className="space-y-2">
          <Label htmlFor="reset-confirm-password" className="text-sm font-medium text-foreground">
            Confirmar nueva contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              placeholder="Confirmar contraseña"
              className="pl-10 pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button
          id="btn-reset-submit"
          type="submit"
          disabled={loading}
          className="w-full h-11 gradient-primary text-primary-foreground font-semibold flex items-center justify-center"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Actualizando contraseña...
            </span>
          ) : (
            'Guardar nueva contraseña'
          )}
        </Button>
      </form>
    </div>
  )
}
