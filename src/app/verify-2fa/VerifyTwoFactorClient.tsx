'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ShieldCheck, Loader2, LogOut } from 'lucide-react'

/**
 * Reto del segundo factor: el usuario ingresa el código TOTP de su app.
 * Al verificar, la sesión sube a AAL2 y se accede al dashboard.
 */
export function VerifyTwoFactorClient() {
  const supabase = createClient()
  const router = useRouter()

  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f) => f.status === 'verified')
      setFactorId(verified?.id ?? null)
      setLoading(false)
    })
  }, [supabase])

  async function verify() {
    if (!factorId || code.length !== 6) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) {
      setBusy(false)
      setCode('')
      setError('Código incorrecto o expirado. Intenta con el código actual de tu app.')
      return
    }
    // Sesión ahora en AAL2 → entrar
    router.replace('/dashboard')
    router.refresh()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  // Auto-verificar al completar los 6 dígitos
  useEffect(() => {
    if (code.length === 6 && !busy && factorId) verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-card-foreground">Verificación en dos pasos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa el código de 6 dígitos de tu app de autenticación.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={busy} autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="bg-background border-border w-11 h-12 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>

            {busy && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
              </p>
            )}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="w-full py-2.5 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none"
            >
              Verificar
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-border flex justify-center">
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
