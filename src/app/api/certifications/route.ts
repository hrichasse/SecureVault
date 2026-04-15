import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { getCertifications, certifyDocument, getPendingCertificationDocuments } from '@/modules/certifications/certification.service'

const createSchema = z.object({
  documentId: z.string().min(1),
  notaryLicenseNumber: z.string().min(4).optional(),
  signPassword: z.string().min(8).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const includePending = searchParams.get('pending') === 'true'

    if (includePending) {
      if (user.role !== 'ADMIN' && user.role !== 'ADMIN_COMPANY' && user.role !== 'NOTARY') {
        return NextResponse.json({ error: 'No tienes permisos para ver documentos pendientes' }, { status: 403 })
      }
      const pendingDocuments = await getPendingCertificationDocuments(user.companyId)
      return NextResponse.json({ data: pendingDocuments }, { status: 200 })
    }

    const certifications = await getCertifications(user.companyId)

    return NextResponse.json({ data: certifications }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/certifications]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Permisos: Solo ADMIN, ADMIN_COMPANY o NOTARY pueden certificar
    if (user.role === 'USER') {
      return NextResponse.json({ error: 'No tienes permisos para certificar documentos' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }

    if (user.role === 'NOTARY') {
      if (!parsed.data.notaryLicenseNumber || !parsed.data.signPassword) {
        return NextResponse.json(
          { error: 'Debes ingresar cédula notarial y contraseña de firma para legalizar.' },
          { status: 400 }
        )
      }
    }

    const result = await certifyDocument(parsed.data.documentId, user.id, user.companyId, parsed.data.notaryLicenseNumber)

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/certifications]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
