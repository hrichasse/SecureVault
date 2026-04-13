import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { hasActivePermission } from '@/modules/access-requests/request.service'
import { getDocumentSignedUrl, getDocumentById } from '@/modules/documents/document.service'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const document = await getDocumentById(params.id, user.companyId)
    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const hasAccess = await hasActivePermission(params.id, user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes permiso para descargar este documento' }, { status: 403 })
    }

    const signedUrl = await getDocumentSignedUrl(document.storagePath, 3600) // 1 hora de duración
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'VIEW_DOCUMENT', // Asumimos que descargar es un tipo de vista profunda
        userId: user.id,
        companyId: user.companyId,
        documentId: document.id,
        metadata: { actionOrigin: 'download' }
      }
    })

    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('[GET /api/documents/[id]/download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
