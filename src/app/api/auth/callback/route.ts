/**
 * GET /api/auth/callback
 *
 * Callback OAuth de Supabase (Google, GitHub, etc.)
 * Intercambia el code PKCE por una sesión, luego:
 * - Si el usuario ya existe en Prisma → /dashboard
 * - Si es nuevo → redirigir a completar registro → /register/complete
 *
 * IMPORTANTE: Se usa createServerClient directamente (no createClient())
 * para poder aplicar las cookies de sesión sobre el propio NextResponse.redirect().
 * Si se usa createClient() (basado en cookies() de next/headers), las cookies
 * quedan en el contexto interno de Next.js y NO se propagan al redirect response,
 * dejando al browser sin sesión al llegar al destino.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/lib/prisma'

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

  // Recopilar las cookies que Supabase quiere escribir para aplicarlas
  // directamente sobre el response de redirect (no via cookies() de next/headers)
  const pendingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          pendingCookies.push(...cookiesToSet)
        },
      },
      cookieOptions: {
        maxAge: 6 * 60 * 60,
      },
    }
  )

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

  // Verificar si ya existe en Prisma por supabaseId
  let existingUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
  })

  // Si no se encontró por supabaseId pero sí por email, actualizar el supabaseId (reconexión de cuenta)
  if (!existingUser && authUser.email) {
    existingUser = await prisma.user.findUnique({
      where: { email: authUser.email }
    })

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { supabaseId: authUser.id }
      })
    }
  }

  const redirectUrl = existingUser
    ? `${origin}/dashboard`
    : `${origin}/register/complete`

  // Crear el redirect y aplicar las cookies de sesión sobre él
  const response = NextResponse.redirect(redirectUrl)
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}
