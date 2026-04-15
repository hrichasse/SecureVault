/**
 * GET /api/audit — Lista paginada de eventos de auditoría
 * Accesible solo por ADMIN y ADMIN_COMPANY de la empresa
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getAuditLogs } from '@/modules/audit/audit.service'
import type { AuditAction } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (user.role === 'USER') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page       = parseInt(searchParams.get('page')  ?? '1', 10)
    const limit      = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const action     = searchParams.get('action') as AuditAction | null
    const startDate  = searchParams.get('startDate') ?? undefined
    const endDate    = searchParams.get('endDate')   ?? undefined
    const documentId = searchParams.get('documentId') ?? undefined

    const result = await getAuditLogs({
      companyId: user.companyId,
      page,
      limit,
      action: action ?? undefined,
      startDate,
      endDate,
      documentId,
    })

    return NextResponse.json({
      data:       result.data,
      total:      result.pagination.total,
      page:       result.pagination.page,
      limit:      result.pagination.limit,
      totalPages: result.pagination.totalPages,
    })
  } catch (error) {
    console.error('[GET /api/audit]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
