/**
 * GET /api/auth/callback
 *
 * Callback OAuth de Supabase (Google, GitHub, etc.)
 * Intercambia el code PKCE por una sesión, luego:
 * - Si el usuario ya existe en Prisma → /dashboard
 * - Si es nuevo → redirigir a completar registro → /register/complete
 *
 * Lo usan el login con Google por redirección (respaldo si GOOGLE_CLIENT_ID no
 * está configurado; ver /api/auth/google/token) y los enlaces de recuperación
 * de contraseña (next=/reset-password).
 *
 * IMPORTANTE: Se usa createRouteHandlerClient (no createClient()) para poder
 * aplicar las cookies de sesión sobre el propio NextResponse.redirect().
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-client'
import { findOrRelinkUser } from '@/modules/auth/oauth-user'

function getAppOrigin(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `http://${host}`
  }

  // En Azure el host puede llegar como contenedor interno (xxxxx:8080).
  // Para cualquier entorno no-local usamos siempre el dominio público.
  return 'https://securevault-ai.azurewebsites.net'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = getAppOrigin(request)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    console.error('[OAuth Callback] Error from provider:', errorParam)
    return NextResponse.redirect(`${origin}/login?error=oauth_provider_error`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // Las cookies de sesión se aplican directamente sobre el response de redirect
  const { supabase, applyCookies } = createRouteHandlerClient(request)

  // Intercambiar el code por una sesión
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    console.error('[OAuth Callback] Exchange error:', exchangeError)
    return NextResponse.redirect(`${origin}/login?error=session_exchange_failed`)
  }

  // Obtener el usuario autenticado
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Usuario de Prisma (por supabaseId, o reconectado por email)
  const existingUser = await findOrRelinkUser(authUser)

  const next = searchParams.get('next')

  let redirectUrl = existingUser
    ? `${origin}/dashboard`
    : `${origin}/register/complete`

  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirectUrl = (existingUser || next === '/reset-password')
      ? `${origin}${next}`
      : `${origin}/register/complete`
  }

  // Crear el redirect y aplicar las cookies de sesión sobre él
  return applyCookies(NextResponse.redirect(redirectUrl))
}
