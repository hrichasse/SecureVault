import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { hasActivePermission } from '@/modules/access-requests/request.service'
import { getDocumentSignedUrl } from '@/modules/documents/document.service'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const document = await prisma.document.findFirst({
      where: { id: params.id, companyId: user.companyId, status: { not: 'DELETED' } },
      include: {
        certifications: {
          where: { isValid: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const hasAccess = await hasActivePermission(params.id, user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes permiso para descargar este documento' }, { status: 403 })
    }

    const cert = document.certifications[0]
    if (!cert || !cert.certificateUrl) {
      return NextResponse.json({ error: 'El documento no tiene una versión certificada disponible' }, { status: 404 })
    }

    const signedUrl = await getDocumentSignedUrl(cert.certificateUrl, 3600) // 1 hora de duración
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'VIEW_DOCUMENT',
        userId: user.id,
        companyId: user.companyId,
        documentId: document.id,
        metadata: { actionOrigin: 'download-certified', certificationId: cert.id }
      }
    })

    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('[GET /api/documents/[id]/download-certified]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
