import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Cliente de Supabase para Route Handlers que inician sesión (OAuth, ID token).
 *
 * No usa cookies() de next/headers: ahí las cookies de sesión quedan en el
 * contexto interno de Next.js y no viajan en un NextResponse.redirect() o
 * NextResponse.json() creado a mano. Se juntan y se aplican con `applyCookies`
 * sobre la respuesta que se devuelve.
 */
export function createRouteHandlerClient(request: NextRequest) {
  const pendingCookies: CookieToSet[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          pendingCookies.push(...cookiesToSet)
        },
      },
      cookieOptions: {
        maxAge: 6 * 60 * 60, // 6 horas, igual que el resto de los clientes
      },
    }
  )

  function applyCookies<T extends NextResponse>(response: T): T {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    })
    return response
  }

  return { supabase, applyCookies }
}
