import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

/**
 * POST /api/auth/login
 *
 * Autentica un usuario con email y password.
 * La sesión se gestiona vía cookies HttpOnly de Supabase SSR.
 * Retorna { success: true, user } o { error: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { email, password } = parsed.data
    const supabase = await createClient()

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      // Mensaje genérico — no revelar qué campo falló
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Buscar usuario en Prisma con datos de empresa
    const user = await prisma.user.findUnique({
      where: { supabaseId: authData.user.id },
      include: { company: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado en el sistema' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/auth/login]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
