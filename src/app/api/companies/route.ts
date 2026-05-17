import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth-utils'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'NOTARY') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: companies })
  } catch (error) {
    console.error('[GET /api/companies]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
