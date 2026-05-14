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
  // Azure App Service provee WEBSITE_HOSTNAME como variable built-in (ej: 'securevault-ai.azurewebsites.net').
  // Es la fuente más confiable porque no depende de headers de proxy, build time, ni config manual.
  const azureHostname = process.env.WEBSITE_HOSTNAME
  const origin = azureHostname
    ? `https://${azureHostname}`
    : (process.env.APP_URL ?? request.nextUrl.origin)

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
