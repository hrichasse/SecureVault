/**
 * POST /api/auth/google/token
 *
 * Login con Google sin pasar el navegador por <proyecto>.supabase.co.
 *
 * El botón de Google (Google Identity Services) entrega un ID token firmado por
 * Google en el propio navegador; aquí el servidor lo canjea por una sesión de
 * Supabase (signInWithIdToken) y deja las cookies en la respuesta. Como el
 * navegador nunca navega al dominio de Supabase, no le afecta que Google Safe
 * Browsing haya marcado ese dominio.
 *
 * Body: { credential: string (ID token de Google), nonce: string (nonce sin hashear) }
 * Responde: { redirectTo } → /dashboard o /register/complete (usuario nuevo).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@/lib/supabase/route-client'
import { findOrRelinkUser } from '@/modules/auth/oauth-user'

const bodySchema = z.object({
  credential: z.string().min(20).max(8192),
  nonce: z.string().min(16).max(128),
})

export async function POST(request: NextRequest) {
  // Solo JSON: un formulario de otro sitio no puede enviar este Content-Type,
  // así que no se puede forzar a un visitante a iniciar sesión en otra cuenta.
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 415 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request)

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: parsed.data.credential,
    nonce: parsed.data.nonce,
  })

  if (error || !data.user) {
    console.error('[Google ID token] Error:', error?.message)
    return NextResponse.json(
      { error: 'Google no pudo verificar tu cuenta. Intenta de nuevo.' },
      { status: 401 }
    )
  }

  const dbUser = await findOrRelinkUser(data.user)

  // El layout del dashboard se encarga de pedir el 2FA si la cuenta lo tiene activo
  return applyCookies(
    NextResponse.json({ redirectTo: dbUser ? '/dashboard' : '/register/complete' })
  )
}
