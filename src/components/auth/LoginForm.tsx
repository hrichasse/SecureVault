'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/modules/auth/actions'

/**
 * LoginForm — formulario de inicio de sesión.
 *
 * Llama al Server Action loginAction() directamente.
 * En éxito: Next.js navega automáticamente a /dashboard.
 * En error: muestra el mensaje sin recargar.
 */
export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
          className="flex items-start gap-2.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm px-4 py-3 rounded-lg"
        >
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="login-email" className="label">
          Correo electrónico
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@empresa.com"
          className="input"
          disabled={loading}
        />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="login-password" className="label mb-0">
            Contraseña
          </label>
          <a
            href="#"
            className="text-xs text-[#3b82f6] hover:text-[#2563eb] transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="input"
          disabled={loading}
        />
      </div>

      {/* Submit */}
      <button
        id="btn-login-submit"
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Iniciando sesión...
          </span>
        ) : (
          'Iniciar sesión'
        )}
      </button>

      {/* Register link */}
      <p className="text-center text-sm text-[#94a3b8]">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="text-[#3b82f6] hover:text-[#2563eb] font-medium transition-colors"
        >
          Regístrate gratis
        </Link>
      </p>
    </form>
  )
}
