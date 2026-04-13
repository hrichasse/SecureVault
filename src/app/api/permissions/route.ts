import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/permissions
 *
 * Query params:
 * - documentId?: permisos de un documento específico (ADMIN/REVIEWER)
 * - userId?: permisos de un usuario específico (ADMIN/REVIEWER)
 * Sin params: permisos activos del usuario autenticado
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    const targetUserId = searchParams.get('userId')

    const isReviewer = user.role === 'ADMIN' || user.role === 'REVIEWER'

    const permissions = await prisma.documentPermission.findMany({
      where: {
        ...(documentId && isReviewer ? { documentId } : {}),
        ...(targetUserId && isReviewer ? { userId: targetUserId } : {}),
        ...(!isReviewer ? { userId: user.id } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        document: { companyId: user.companyId },
      },
      include: {
        document: {
          select: { id: true, name: true, confidentialityLevel: true },
        },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: permissions }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/permissions]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
