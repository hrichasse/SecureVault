'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ShieldCheck, ShieldAlert, Loader2, Smartphone, KeyRound } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

/**
 * Sección de Verificación en dos pasos (2FA / TOTP) para Configuración.
 *
 * Usa la MFA nativa de Supabase (factor TOTP, compatible con Google
 * Authenticator, Authy, 1Password, etc.). Es opt-in: el usuario activa,
 * escanea el QR y confirma con un código de 6 dígitos.
 */
export function TwoFactorSection() {
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  // Estado de activación en curso
  const [enrolling, setEnrolling] = useState(false)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error && data) {
      const verified = data.totp?.find((f) => f.status === 'verified')
      setEnabled(!!verified)
      setFactorId(verified?.id ?? null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function startEnroll() {
    setBusy(true)
    setError(null)
    try {
      // Limpiar factores TOTP no verificados de intentos previos (evita "factor ya existe")
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.totp ?? []) {
        if (f.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `SecureVault ${Date.now()}`,
      })
      if (error || !data) {
        setError(error?.message ?? 'No se pudo iniciar la activación.')
        return
      }
      setEnrollFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setCode('')
      setEnrolling(true)
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll() {
    if (!enrollFactorId || code.length !== 6) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollFactorId,
      code,
    })
    setBusy(false)
    if (error) {
      setError('Código incorrecto. Verifica que la hora de tu teléfono esté sincronizada.')
      setCode('')
      return
    }
    setEnrolling(false)
    setQr(null)
    setSecret(null)
    setCode('')
    toast({ title: '2FA activado', description: 'Tu cuenta ahora pedirá un segundo factor al iniciar sesión.' })
    refresh()
  }

  async function cancelEnroll() {
    if (enrollFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollFactorId }).catch(() => {})
    }
    setEnrolling(false)
    setQr(null)
    setSecret(null)
    setCode('')
    setError(null)
  }

  async function disable2fa() {
    if (!factorId) return
    if (!confirm('¿Desactivar la verificación en dos pasos? Tu cuenta quedará protegida solo por contraseña.')) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (error) {
      toast({ title: 'No se pudo desactivar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: '2FA desactivado' })
    refresh()
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Verificación en dos pasos (2FA)
        </h2>
        {!loading && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
              enabled
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-success' : 'bg-muted-foreground'}`} />
            {enabled ? 'Activado' : 'Desactivado'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando estado…
        </div>
      ) : enrolling ? (
        /* ── Paso de activación: QR + código ── */
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            1. Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, 1Password…).
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {qr && (
              qr.trim().startsWith('<svg')
                ? <div className="bg-white p-3 rounded-lg shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
                : <img src={qr} alt="Código QR para 2FA" className="bg-white p-3 rounded-lg w-44 h-44 shrink-0" />
            )}
            <div className="space-y-3 min-w-0">
              <div>
                <p className="text-xs text-muted-foreground mb-1">¿No puedes escanear? Ingresa esta clave manualmente:</p>
                <code className="block text-xs font-mono bg-muted/40 border border-border rounded-lg px-3 py-2 break-all text-foreground">
                  {secret}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> 2. Ingresa el código de 6 dígitos que muestra la app:
                </p>
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="bg-background border-border" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={confirmEnroll}
                  disabled={busy || code.length !== 6}
                  className="px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none inline-flex items-center gap-2"
                >
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : 'Activar 2FA'}
                </button>
                <button
                  onClick={cancelEnroll}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : enabled ? (
        /* ── Activado ── */
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <Smartphone className="w-5 h-5 text-success mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Tu cuenta está protegida con un segundo factor. Al iniciar sesión te pediremos el código de tu app de autenticación.
            </p>
          </div>
          <button
            onClick={disable2fa}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Desactivar 2FA
          </button>
        </div>
      ) : (
        /* ── Desactivado ── */
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Añade una capa extra de seguridad. Con 2FA, aunque alguien conozca tu contraseña, no podrá entrar sin el código de tu teléfono.
            </p>
          </div>
          <button
            onClick={startEnroll}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparando…</> : <><ShieldCheck className="w-4 h-4" /> Activar 2FA</>}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
