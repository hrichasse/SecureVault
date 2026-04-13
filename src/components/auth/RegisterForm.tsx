'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/modules/auth/actions'

/**
 * RegisterForm — formulario de registro de empresa y usuario.
 *
 * Campos: nombre, nombre de empresa, email, password.
 * Llama al Server Action registerAction() directamente.
 * En éxito: navega automáticamente a /dashboard.
 * En error: muestra el mensaje sin recargar.
 */
export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validación de cliente: passwords match no aplica aquí (single field)
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

      {/* Nombre completo */}
      <div>
        <label htmlFor="reg-name" className="label">
          Nombre completo
        </label>
        <input
          id="reg-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          placeholder="Juan García"
          className="input"
          disabled={loading}
        />
      </div>

      {/* Nombre de empresa */}
      <div>
        <label htmlFor="reg-company" className="label">
          Nombre de la empresa
        </label>
        <input
          id="reg-company"
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          minLength={2}
          placeholder="Acme Corp"
          className="input"
          disabled={loading}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="reg-email" className="label">
          Correo electrónico
        </label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-password" className="label">
          Contraseña
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className="input"
          disabled={loading}
        />
        <p className="text-xs text-[#64748b] mt-1.5">Mínimo 8 caracteres</p>
      </div>

      {/* Terms */}
      <div className="flex items-start gap-2.5">
        <input
          id="reg-terms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-[#334155] bg-[#0f172a] text-[#3b82f6] focus:ring-[#3b82f6] cursor-pointer"
          disabled={loading}
        />
        <label htmlFor="reg-terms" className="text-sm text-[#94a3b8] cursor-pointer leading-relaxed">
          Acepto los{' '}
          <a href="#" className="text-[#3b82f6] hover:underline">
            términos de servicio
          </a>{' '}
          y la{' '}
          <a href="#" className="text-[#3b82f6] hover:underline">
            política de privacidad
          </a>
        </label>
      </div>

      {/* Submit */}
      <button
        id="btn-register-submit"
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
            Creando cuenta...
          </span>
        ) : (
          'Crear cuenta'
        )}
      </button>

      {/* Login link */}
      <p className="text-center text-sm text-[#94a3b8]">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="text-[#3b82f6] hover:text-[#2563eb] font-medium transition-colors"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  )
}
