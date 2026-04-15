import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'ADMIN_COMPANY', 'NOTARY']),
  companyName: z.string().max(200).optional(),
  companyRut: z.string().max(30).optional(),
  companyAddress: z.string().max(300).optional(),
  companyBusinessLine: z.string().max(200).optional(),
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

    const {
      name,
      email,
      password,
      role,
      companyName,
      companyRut,
      companyAddress,
      companyBusinessLine,
    } = parsed.data

    if (role === 'ADMIN_COMPANY') {
      if (!companyName || !companyRut || !companyAddress || !companyBusinessLine) {
        return NextResponse.json({ error: 'Faltan datos de empresa para ADMIN_COMPANY' }, { status: 400 })
      }
    }
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
      let targetCompanyId = ''

      if (role === 'ADMIN_COMPANY') {
        const company = await tx.company.create({
          data: {
            name: companyName!,
            email,
            rut: companyRut,
            address: companyAddress,
            businessLine: companyBusinessLine,
            adminName: name,
          },
        })
        targetCompanyId = company.id
      } else {
        const secureVaultCompany = await tx.company.upsert({
          where: { email: 'admin@securevault.cl' },
          update: { name: 'Secure Vault' },
          create: {
            name: 'Secure Vault',
            email: 'admin@securevault.cl',
            rut: '76.000.000-0',
            address: 'Santiago, Chile',
            businessLine: 'Software y Ciberseguridad',
            adminName: 'Equipo Secure Vault',
            description: 'Empresa base del sistema SecureVault',
          },
        })
        targetCompanyId = secureVaultCompany.id
      }

      return tx.user.create({
        data: {
          supabaseId: authData.user!.id,
          email,
          name,
          role,
          companyId: targetCompanyId,
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
