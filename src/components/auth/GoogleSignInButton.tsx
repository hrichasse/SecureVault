'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Botón "Continuar con Google".
 *
 * Con `clientId` usa Google Identity Services: Google entrega un ID token en el
 * navegador (popup de accounts.google.com) y /api/auth/google/token lo canjea por
 * la sesión de Supabase en el servidor. El navegador nunca navega a
 * <proyecto>.supabase.co, cuyo dominio Google Safe Browsing marcó como peligroso.
 *
 * Sin `clientId` (variable GOOGLE_CLIENT_ID no configurada) cae al flujo antiguo
 * por redirección (/api/auth/google), que sí pasa por supabase.co.
 */

interface GoogleIdApi {
  initialize(config: Record<string, unknown>): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleIdentity(): Promise<GoogleIdApi> {
  return new Promise((resolve, reject) => {
    const ready = () => window.google?.accounts?.id
    if (ready()) return resolve(ready()!)

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => (ready() ? resolve(ready()!) : reject(new Error('gis'))))
    script.addEventListener('error', () => reject(new Error('gis')))
  })
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** Nonce contra reuso del token: a Google va el hash, a Supabase el valor original. */
async function createNonce() {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return { raw, hashed: toHex(new Uint8Array(digest)) }
}

interface Props {
  clientId?: string
  /** Texto del botón de Google */
  text?: 'continue_with' | 'signin_with' | 'signup_with'
  /** Texto del botón de respaldo (flujo por redirección) */
  fallbackLabel?: string
  disabled?: boolean
  onError: (message: string) => void
}

export function GoogleSignInButton({
  clientId,
  text = 'continue_with',
  fallbackLabel = 'Continuar con Google',
  disabled,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const [status, setStatus] = useState<'loading' | 'ready' | 'signing' | 'unavailable'>(
    clientId ? 'loading' : 'unavailable'
  )

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    ;(async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()])
        const container = containerRef.current
        if (cancelled || !container) return

        gis.initialize({
          client_id: clientId,
          nonce: nonce.hashed,
          ux_mode: 'popup',
          auto_select: false,
          callback: async ({ credential }: { credential?: string }) => {
            if (!credential) return onErrorRef.current('Google no devolvió la cuenta. Intenta de nuevo.')
            setStatus('signing')
            try {
              const res = await fetch('/api/auth/google/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential, nonce: nonce.raw }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || typeof data.redirectTo !== 'string') {
                throw new Error(data.error || 'No se pudo iniciar sesión con Google.')
              }
              // Navegación completa: el servidor debe leer las cookies de sesión nuevas
              window.location.assign(data.redirectTo)
            } catch (error) {
              setStatus('ready')
              onErrorRef.current(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.')
            }
          },
        })

        // Medir el ancho ya con la página maquetada (en el primer render puede ser 0)
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (cancelled) return
        const measured = Math.floor(container.getBoundingClientRect().width)
        const dark = document.documentElement.classList.contains('dark')
        gis.renderButton(container, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          locale: 'es',
          // Google acepta entre 200 y 400 px
          width: measured > 0 ? Math.min(400, Math.max(200, measured)) : 300,
        })
        setStatus('ready')
      } catch {
        // No cargó el script de Google (sin red, bloqueador de anuncios, etc.)
        if (!cancelled) setStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, text])

  if (status === 'unavailable') {
    return (
      <a
        href="/api/auth/google"
        aria-disabled={disabled}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground aria-disabled:opacity-50 aria-disabled:pointer-events-none"
      >
        <GoogleLogo />
        {fallbackLabel}
      </a>
    )
  }

  return (
    <div className={`relative w-full min-h-11 flex justify-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div ref={containerRef} className="w-full flex justify-center" />
      {status === 'loading' && <div className="absolute inset-0 h-11 rounded-lg bg-muted animate-pulse" />}
      {status === 'signing' && (
        <div className="absolute inset-0 h-11 flex items-center justify-center gap-2 rounded-lg bg-card/90 text-sm text-foreground">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Iniciando sesión...
        </div>
      )}
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
