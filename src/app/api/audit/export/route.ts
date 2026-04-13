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
    const action = searchParams.get('action') as AuditAction | undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const documentId = searchParams.get('documentId') || undefined

    // For export, we might fetch a larger limit or just max allowed (e.g. 1000)
    const result = await getAuditLogs({
      companyId: user.companyId,
      page: 1,
      limit: 5000, 
      action,
      startDate,
      endDate,
      documentId,
    })

    // Create CSV content
    const headers = ['Fecha', 'Acción', 'Usuario', 'Documento', 'Detalles/Metadata', 'IP']
    
    const rows = result.data.map(log => {
      const date = new Date(log.createdAt).toISOString()
      const actionLabel = log.action
      const userName = log.user?.name || 'Sistema/Anónimo'
      const docName = log.document?.name || '-'
      const metadataStr = log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '-'
      const ip = log.ipAddress || '-'

      // Wrap in double quotes to handle commas within fields
      return `"${date}","${actionLabel}","${userName}","${docName}","${metadataStr}","${ip}"`
    })

    const csvContent = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="audit_export.csv"',
      },
    })
  } catch (error) {
    console.error('[GET /api/audit/export]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
