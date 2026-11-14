/**
 * Auth Service — servidor-side authentication helpers.
 *
 * Verifica la sesión de Supabase y devuelve el usuario de Prisma
 * con la relación company incluida para el layout.
 */

import { createClient } from '@/lib/supabase/server'
import { isSecondFactorPending } from '@/lib/supabase/mfa'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types'

export interface AuthUserWithCompany {
  id: string
  supabaseId: string
  email: string
  name: string
  role: UserRole
  companyId: string
  company: {
    id: string
    name: string
    email: string
    description: string | null
  }
}

/**
 * Obtiene el usuario autenticado con su empresa.
 * Retorna null si no hay sesión válida, si falta el segundo factor o si el
 * usuario no existe en BD.
 *
 * `allowPendingSecondFactor` es solo para el layout del dashboard y sus páginas:
 * el layout ya redirige a /verify-2fa, y si la página recibiera null mandaría a
 * /login, que a su vez rebota al dashboard (bucle). Las rutas API nunca lo usan.
 */
export async function getAuthUser(
  { allowPendingSecondFactor = false }: { allowPendingSecondFactor?: boolean } = {}
): Promise<AuthUserWithCompany | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return null
    if (!allowPendingSecondFactor && (await isSecondFactorPending(supabase, authUser))) return null

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            description: true,
          },
        },
      },
    })

    return user as AuthUserWithCompany | null
  } catch {
    return null
  }
}
