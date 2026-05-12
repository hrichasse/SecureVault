/**
 * GET /api/auth/callback
 *
 * Callback OAuth de Supabase (Google, GitHub, etc.)
 * Intercambia el code PKCE por una sesión, luego:
 * - Si el usuario ya existe en Prisma → /dashboard
 * - Si es nuevo → crea usuario con rol ADMIN_COMPANY + empresa + suscripción FREE → /dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    console.error('[OAuth Callback] Error from provider:', errorParam)
    return NextResponse.redirect(`${origin}/login?error=oauth_provider_error`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

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

  if (existingUser) {
    // Usuario conocido → dashboard directo
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Usuario nuevo (primer login con Google) → redirigir a completar registro
  return NextResponse.redirect(`${origin}/register/complete`)
}
