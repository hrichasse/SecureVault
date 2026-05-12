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
  const origin = request.nextUrl.origin

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
