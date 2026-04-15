/**
 * Auth Service — servidor-side authentication helpers.
 *
 * Verifica la sesión de Supabase y devuelve el usuario de Prisma
 * con la relación company incluida para el layout.
 */

import { createClient } from '@/lib/supabase/server'
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
 * Retorna null si no hay sesión válida o el usuario no existe en BD.
 */
export async function getAuthUser(): Promise<AuthUserWithCompany | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return null

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
