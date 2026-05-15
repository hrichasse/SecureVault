/**
 * GET /api/auth/google
 *
 * Inicia el flujo OAuth con Google via Supabase.
 * Retorna la URL de redirección de Google.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const origin = getAppOrigin(request)

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
