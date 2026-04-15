import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/modules/auth/auth.service'

/**
 * GET /api/admin/users
 * Lista usuarios de la empresa del admin autenticado.
 * Solo accesible para rol ADMIN.
 */
export async function GET() {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { companyId: authUser.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
