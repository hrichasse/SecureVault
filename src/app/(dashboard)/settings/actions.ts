'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const updateNameSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
})

export async function updateUserNameAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const raw = { name: (formData.get('name') as string)?.trim() }
  const parsed = updateNameSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true },
  })
  if (!dbUser) {
    redirect('/login')
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { name: parsed.data.name },
  })

  revalidatePath('/settings')
  revalidatePath('/dashboard') // Actualizar sidebar que muestra el nombre
  return { success: true }
}
