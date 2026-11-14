/**
 * GET /auth/confirm?token_hash=...&type=recovery&next=/reset-password
 *
 * Verifica en el servidor los enlaces que Supabase manda por correo
 * (recuperar contraseña, y confirmar email si algún día se activa).
 *
 * El enlace por defecto de Supabase lleva al navegador a
 * <proyecto>.supabase.co/auth/v1/verify, dominio que Google Safe Browsing marcó
 * como peligroso. Con la plantilla de correo apuntando aquí, el navegador nunca
 * sale del dominio de la app:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 *
 * Vivía en /api/auth/confirm, pero Safe Browsing también marcó esa URL (y
 * /api/auth/me) de la app. /api/auth/confirm queda como alias para los correos
 * ya enviados. La solución de fondo es pedir la revisión en Google Search Console.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-client'
import { getAppOrigin, safeNextPath } from '@/lib/app-origin'

const ALLOWED_TYPES: EmailOtpType[] = ['recovery', 'email', 'signup', 'invite', 'magiclink', 'email_change']

const DEFAULT_NEXT: Partial<Record<EmailOtpType, string>> = {
  recovery: '/reset-password',
}

export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request.headers.get('host'))
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const invalid = (reason: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${type === 'recovery' ? 'invalid_reset_link' : 'invalid_link'}&reason=${reason}`
    )

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return invalid('params')

  const { supabase, applyCookies } = createRouteHandlerClient(request)
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    console.error('[Auth confirm] verifyOtp:', error.message)
    return invalid('expired')
  }

  const next = safeNextPath(searchParams.get('next'), DEFAULT_NEXT[type] ?? '/dashboard')
  return applyCookies(NextResponse.redirect(`${origin}${next}`))
}
