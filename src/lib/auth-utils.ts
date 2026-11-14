/**
 * Utilidades de autenticación para Server (API Routes / Server Actions).
 *
 * Verifica la sesión de Supabase y devuelve el usuario de Prisma.
 * Importar solo en código de servidor (no en 'use client').
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isSecondFactorPending } from '@/lib/supabase/mfa'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types'

export interface AuthUser {
  id: string
  supabaseId: string
  email: string
  name: string
  role: UserRole
  companyId: string
}

/**
 * Obtiene el usuario autenticado desde la sesión de Supabase.
 * Retorna null si no hay sesión válida, si falta el segundo factor (2FA activo
 * pero sesión en AAL1) o si el usuario no existe en BD.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return null
    if (await isSecondFactorPending(supabase, authUser)) return null

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    })

    return user
  } catch {
    return null
  }
}

/**
 * Comprueba la contraseña de la cuenta (re-autenticación antes de firmar).
 *
 * Usa un cliente aparte, sin cookies ni persistencia, para no tocar la sesión
 * del usuario. La sesión temporal que crea el login se revoca al instante con
 * scope 'local' (el scope por defecto, 'global', cerraría todas sus sesiones).
 */
export async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return true
}
