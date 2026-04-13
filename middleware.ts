import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware de autenticación para SecureVault AI.
 *
 * Responsabilidades:
 * - Refrescar la sesión de Supabase en cada request (renovar cookies)
 * - Proteger rutas del dashboard: sin sesión → redirigir a /login
 *
 * NOTA: getUser() valida el JWT contra los servidores de Supabase.
 *       NO usar getSession() en middleware (no valida server-side).
 *
 * El redirect "login/register → /dashboard si hay sesión" se maneja
 * en los propios page.tsx de esas rutas (Server Components).
 */
export async function middleware(request: NextRequest) {
  // Respuesta base que se actualiza con las cookies de sesión
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagar cookies al request (para otros middlewares)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Crear nueva respuesta con las cookies actualizadas
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validar sesión (server-side, seguro)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión en ruta protegida → redirigir a /login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preservar la URL original para redirigir después del login
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Importante: devolver supabaseResponse (no NextResponse.next())
  // para que las cookies de sesión actualizadas se propaguen
  return supabaseResponse
}

export const config = {
  matcher: [
    // Proteger SOLO rutas del dashboard — NUNCA rutas /api/* ni públicas
    '/(dashboard)/:path*',
    '/dashboard/:path*',
    '/documents/:path*',
    '/requests/:path*',
    '/incidents/:path*',
    '/certifications/:path*',
    '/audit/:path*',
    '/settings/:path*',
  ],
}
