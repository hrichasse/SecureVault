import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import {
  getDocumentById,
  deleteDocument,
} from '@/modules/documents/document.service'
import { prisma } from '@/lib/prisma'
import type { ConfidentialityLevel } from '@/types'

// ── GET /api/documents/[id] ────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const document = await getDocumentById(params.id, user.companyId)
    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    // AuditLog: VIEW_DOCUMENT
    await prisma.auditLog.create({
      data: {
        action: 'VIEW_DOCUMENT',
        userId: user.id,
        companyId: user.companyId,
        documentId: document.id,
      },
    })

    return NextResponse.json({ data: document }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/documents/[id]]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── PATCH /api/documents/[id] ──────────────────────────────

const VALID_LEVELS = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { description, confidentialityLevel } = body

    const existing = await getDocumentById(params.id, user.companyId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    if (
      confidentialityLevel &&
      !VALID_LEVELS.includes(confidentialityLevel as ConfidentialityLevel)
    ) {
      return NextResponse.json(
        { error: 'Nivel de confidencialidad inválido' },
        { status: 400 }
      )
    }

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(description !== undefined && { description }),
        ...(confidentialityLevel && {
          confidentialityLevel: confidentialityLevel as ConfidentialityLevel,
        }),
      },
    })

    return NextResponse.json({ data: updated }, { status: 200 })
  } catch (error) {
    console.error('[PATCH /api/documents/[id]]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── DELETE /api/documents/[id] ─────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await deleteDocument(params.id, user.companyId, user.id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    console.error('[DELETE /api/documents/[id]]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
