/**
 * GET /api/auth/clear
 * 
 * Endpoint de emergencia para limpiar sesiones corruptas.
 * Útil cuando hay ERR_TOO_MANY_REDIRECTS por cookies inválidas.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  
  // Forzar cierre de sesión aunque sea inválida
  await supabase.auth.signOut()

  // Redirigir al login con un parámetro para evitar cache
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  )

  // Limpiar todas las cookies de Supabase manualmente
  const cookieNames = [
    `sb-lbbxduncrgmffmrvdqtu-auth-token`,
    `sb-lbbxduncrgmffmrvdqtu-auth-token-code-verifier`,
    `sb-access-token`,
    `sb-refresh-token`,
  ]

  cookieNames.forEach(name => {
    response.cookies.set(name, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
  })

  return response
}
