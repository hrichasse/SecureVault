import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(200),
})

/**
 * POST /api/auth/register
 *
 * Registra un nuevo usuario y empresa.
 * 1. Crea el usuario en Supabase Auth (obtiene supabaseId)
 * 2. Crea la Company y el User en Prisma (transacción)
 * Retorna { success: true, user } o { error: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { name, email, password, companyName } = parsed.data
    const supabase = await createClient()

    // 1. Supabase Auth — crear usuario
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (authError) {
      if (
        authError.message.toLowerCase().includes('already registered') ||
        authError.message.toLowerCase().includes('already exists')
      ) {
        return NextResponse.json(
          { error: 'Email ya registrado' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Error al crear usuario en Auth' },
        { status: 500 }
      )
    }

    // 2. Prisma — crear Company y User en transacción
    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: companyName, email },
      })

      return tx.user.create({
        data: {
          supabaseId: authData.user!.id,
          email,
          name,
          role: 'ADMIN',
          companyId: company.id,
        },
        include: { company: true },
      })
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/auth/register]', error)
    const pgError = error as { code?: string }
    if (pgError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una empresa con ese email' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
