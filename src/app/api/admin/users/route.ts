import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAuthUser } from '@/modules/auth/auth.service'
import { logEvent } from '@/modules/audit/audit.service'
import type { UserRole } from '@/types'

const CREATABLE_ROLES: Record<UserRole, UserRole[]> = {
  ADMIN: ['ADMIN', 'ADMIN_COMPANY', 'USER', 'NOTARY'],
  ADMIN_COMPANY: ['USER', 'NOTARY'],
  USER: [],
  NOTARY: [],
}

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña temporal debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'ADMIN_COMPANY', 'USER', 'NOTARY']),
  companyName: z.string().max(200).optional(),
  companyRut: z.string().max(30).optional(),
  companyAddress: z.string().max(300).optional(),
  companyBusinessLine: z.string().max(200).optional(),
})

const patchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'ADMIN_COMPANY', 'USER', 'NOTARY']),
})

export async function GET() {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (authUser.role !== 'ADMIN' && authUser.role !== 'ADMIN_COMPANY') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const where = authUser.role === 'ADMIN' ? {} : { companyId: authUser.companyId }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('[GET /api/admin/users]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const allowed = CREATABLE_ROLES[authUser.role as UserRole] ?? []
    if (allowed.length === 0) {
      return NextResponse.json({ error: 'Sin permisos para crear usuarios' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
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

    if (!allowed.includes(role as UserRole)) {
      return NextResponse.json(
        { error: `Tu rol no puede crear usuarios con rol "${role}"` },
        { status: 403 }
      )
    }

    if (role === 'ADMIN_COMPANY') {
      if (authUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo ADMIN puede crear administradores de empresa' }, { status: 403 })
      }
      if (!companyName || !companyRut || !companyAddress || !companyBusinessLine) {
        return NextResponse.json(
          { error: 'Para ADMIN_COMPANY debes informar nombre, RUT, dirección y giro de empresa' },
          { status: 400 }
        )
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) {
      if (
        authError.message.toLowerCase().includes('already registered') ||
        authError.message.toLowerCase().includes('already been registered')
      ) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario en autenticación' }, { status: 500 })
    }

    let targetCompanyId = authUser.companyId

    if (role === 'ADMIN_COMPANY') {
      const createdCompany = await prisma.company.create({
        data: {
          name: companyName!,
          email,
          rut: companyRut,
          address: companyAddress,
          businessLine: companyBusinessLine,
          adminName: name,
        },
        select: { id: true },
      })
      targetCompanyId = createdCompany.id
    } else if (role === 'ADMIN' || role === 'NOTARY') {
      const secureVaultCompany = await prisma.company.upsert({
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
        select: { id: true },
      })
      targetCompanyId = secureVaultCompany.id
    }

    const newUser = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        name,
        role: role as UserRole,
        companyId: targetCompanyId,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    await logEvent({
      action: 'REGISTER',
      userId: authUser.id,
      companyId: authUser.companyId,
      metadata: {
        createdUser: newUser.id,
        role,
        createdBy: authUser.email,
        createdCompany: role === 'ADMIN_COMPANY' ? companyName : 'Secure Vault',
      },
    })

    return NextResponse.json({ data: newUser }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/users]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const allowed = CREATABLE_ROLES[authUser.role as UserRole] ?? []
    if (allowed.length === 0) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { userId, role } = parsed.data

    if (!allowed.includes(role as UserRole)) {
      return NextResponse.json({ error: `No puedes asignar el rol "${role}"` }, { status: 403 })
    }

    const targetWhere = authUser.role === 'ADMIN'
      ? { id: userId }
      : { id: userId, companyId: authUser.companyId }

    const target = await prisma.user.findFirst({
      where: targetWhere,
      select: { id: true },
    })

    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    if (userId === authUser.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PATCH /api/admin/users]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (authUser.role !== 'ADMIN' && authUser.role !== 'ADMIN_COMPANY') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

    if (userId === authUser.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 })
    }

    const targetWhere = authUser.role === 'ADMIN'
      ? { id: userId }
      : { id: userId, companyId: authUser.companyId }

    const target = await prisma.user.findFirst({
      where: targetWhere,
      select: { id: true, role: true, supabaseId: true },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    if (authUser.role === 'ADMIN_COMPANY' && (target.role === 'ADMIN' || target.role === 'ADMIN_COMPANY')) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar ese usuario' }, { status: 403 })
    }

    await supabaseAdmin.auth.admin.deleteUser(target.supabaseId)
    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/users]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
