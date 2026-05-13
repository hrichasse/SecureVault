/**
 * GET /api/auth/google
 *
 * Inicia el flujo OAuth con Google via Supabase.
 * Retorna la URL de redirección de Google.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  // Azure App Service termina TLS en el proxy y expone los headers x-forwarded-*.
  // request.nextUrl.origin devuelve "http://" (protocolo interno) y NEXT_PUBLIC_APP_URL
  // solo se bake en código cliente en Next.js App Router, no en route handlers.
  // Usar x-forwarded-proto/host es la forma correcta de reconstruir el origin real.
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
    ?? request.nextUrl.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.nextUrl.host
  const origin = `${proto}://${host}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    console.error('[Google OAuth] Error:', error)
    return NextResponse.redirect(`${origin}/login?error=google_oauth_failed`)
  }

  return NextResponse.redirect(data.url)
}
