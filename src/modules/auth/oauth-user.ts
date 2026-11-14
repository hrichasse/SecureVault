/**
 * Vincula una sesión de Google (OAuth o ID token) con el usuario de la BD.
 */
import { prisma } from '@/lib/prisma'

/**
 * Busca el usuario de Prisma por supabaseId. Si no existe pero hay uno con el
 * mismo email (Google lo entrega verificado), lo reconecta a esta cuenta de
 * Supabase. Retorna null si es un usuario nuevo que debe completar el registro.
 */
export async function findOrRelinkUser(authUser: { id: string; email?: string | null }) {
  const bySupabaseId = await prisma.user.findUnique({ where: { supabaseId: authUser.id } })
  if (bySupabaseId || !authUser.email) return bySupabaseId

  const byEmail = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!byEmail) return null

  return prisma.user.update({
    where: { id: byEmail.id },
    data: { supabaseId: authUser.id },
  })
}
