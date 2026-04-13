import { NextResponse } from 'next/server'
import { verifyCertification } from '@/modules/certifications/certification.service'

/**
 * GET /api/certifications/verify/[code]
 * RUTA PÚBLICA (SIN AUTH)
 */
export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const certification = await verifyCertification(params.code)

    if (!certification || !certification.isValid) {
      return NextResponse.json(
        { valid: false, message: 'No se encontró certificación para este código o ha sido revocada' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        valid: true,
        data: {
          name: certification.document.name,
          sha256Hash: certification.sha256Hash,
          certifiedAt: certification.createdAt,
          company: certification.document.company?.name,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[GET /api/certifications/verify/[code]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
