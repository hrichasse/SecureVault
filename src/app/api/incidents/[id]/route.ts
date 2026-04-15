import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { getIncidentById, updateIncident } from '@/modules/incidents/incident.service'

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedToId: z.string().nullable().optional(),
  resolution: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const incident = await getIncidentById(params.id, user.companyId)
    if (!incident) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data: incident }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/incidents/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Solo ADMIN_COMPANY O ADMIN pueden actualizar incidentes (asignar/cerrar)
    if (user.role === 'USER') {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar incidentes' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }

    // assignedToId puede venir null para desasignar (zod lo parsea como null), 
    // pero prisma lo espera como string | null
    const updateData = {
      ...parsed.data,
      assignedToId: parsed.data.assignedToId === null ? undefined : parsed.data.assignedToId,
    }

    const result = await updateIncident(
      params.id,
      updateData,
      user.id,
      user.companyId
    )

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error: unknown) {
    console.error('[PATCH /api/incidents/[id]]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
