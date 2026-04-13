import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getAuditLogs } from '@/modules/audit/audit.service'
import type { AuditAction } from '@/types'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (user.role === 'USER') {
      return NextResponse.json({ error: 'No tienes permisos de auditoría' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const action = searchParams.get('action') as AuditAction | undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const documentId = searchParams.get('documentId') || undefined

    const result = await getAuditLogs({
      companyId: user.companyId,
      page,
      limit,
      action,
      startDate,
      endDate,
      documentId,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[GET /api/audit]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
