import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        _count: {
          select: { users: true, documents: true },
        },
      },
    })

    return NextResponse.json({ data: companies }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/admin/crm/companies]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
