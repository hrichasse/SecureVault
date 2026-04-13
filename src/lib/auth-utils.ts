/**
 * Utilidades de autenticación para Server (API Routes / Server Actions).
 *
 * Verifica la sesión de Supabase y devuelve el usuario de Prisma.
 * Importar solo en código de servidor (no en 'use client').
 */

import { createClient } from '@/lib/supabase/server'
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
 * Retorna null si no hay sesión válida o el usuario no existe en BD.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
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
      },
    })

    return user
  } catch {
    return null
  }
}
