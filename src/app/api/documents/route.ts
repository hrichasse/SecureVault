import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { uploadDocument, getDocuments } from '@/modules/documents/document.service'
import { canAddDocument } from '@/modules/subscriptions/subscriptions.service'
import type { ConfidentialityLevel, DocumentStatus } from '@/types'

// ── GET /api/documents ─────────────────────────────────────

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as DocumentStatus | null
    const confidentialityLevel = searchParams.get('level') as ConfidentialityLevel | null
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)

    const targetCompanyId = searchParams.get('companyId')
    const finalCompanyId = user.role === 'NOTARY' && targetCompanyId ? targetCompanyId : (user.role === 'NOTARY' ? undefined : user.companyId)

    const result = await getDocuments({
      companyId: finalCompanyId,
      ...(status && { status }),
      ...(confidentialityLevel && { confidentialityLevel }),
      page,
      limit,
    })

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/documents]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── POST /api/documents ────────────────────────────────────

const VALID_LEVELS = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Límite del plan: aplica a las empresas clientes (no a la empresa base del
    // sistema, donde están ADMIN y NOTARY)
    if (
      (user.role === 'ADMIN_COMPANY' || user.role === 'USER') &&
      !(await canAddDocument(user.companyId))
    ) {
      return NextResponse.json(
        { error: 'Tu empresa alcanzó el límite de documentos de su plan. Mejora el plan para subir más.' },
        { status: 403 }
      )
    }

    // Parsear multipart/form-data
    const formData = await request.formData()
    const file = formData.get('file')
    const description = formData.get('description') as string | null
    const overrideLevelRaw = formData.get('confidentialityLevel') as string | null

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Se requiere un archivo PDF' },
        { status: 400 }
      )
    }

    // Validar override de nivel si se provee
    const overrideLevel =
      overrideLevelRaw &&
      VALID_LEVELS.includes(overrideLevelRaw as ConfidentialityLevel)
        ? (overrideLevelRaw as ConfidentialityLevel)
        : undefined

    const document = await uploadDocument({
      file,
      description: description || undefined,
      overrideLevel,
      companyId: user.companyId,
      uploadedById: user.id,
    })

    return NextResponse.json({ data: document }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/documents]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
