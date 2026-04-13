import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { getIncidents, createIncident } from '@/modules/incidents/incident.service'
import type { IncidentStatus, IncidentPriority, IncidentType } from '@/types'

const createSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(100),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  type: z.enum([
    'ACCESS_DENIED',
    'DOCUMENT_LOST',
    'DATA_BREACH',
    'PERMISSION_EXPIRED',
    'INTEGRITY_FAILURE',
    'CLASSIFICATION_ERROR',
    'OTHER',
  ]),
  documentId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as IncidentStatus | undefined
    const priority = searchParams.get('priority') as IncidentPriority | undefined
    const type = searchParams.get('type') as IncidentType | undefined
    const documentId = searchParams.get('documentId') || undefined

    const incidents = await getIncidents({
      companyId: user.companyId,
      status,
      priority,
      type,
      documentId,
    })

    return NextResponse.json({ data: incidents }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/incidents]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }

    const result = await createIncident(
      parsed.data,
      user.id,
      user.companyId
    )

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/incidents]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
