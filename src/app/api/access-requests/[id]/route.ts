import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import {
  approveRequest,
  rejectRequest,
} from '@/modules/access-requests/request.service'

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    reviewNote: z.string().max(500).optional(),
    grantDurationDays: z.number().int().positive().max(365).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    reviewNote: z.string().min(5, 'Indica el motivo del rechazo').max(500),
  }),
])

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (user.role === 'USER') {
      return NextResponse.json(
        { error: 'Solo ADMIN o ADMIN_COMPANY pueden revisar solicitudes' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }

    let result

    if (parsed.data.action === 'approve') {
      result = await approveRequest({
        requestId: params.id,
        reviewerId: user.id,
        reviewNote: parsed.data.reviewNote,
        grantDurationDays: parsed.data.grantDurationDays,
        companyId: user.companyId,
      })
    } else {
      result = await rejectRequest({
        requestId: params.id,
        reviewerId: user.id,
        reviewNote: parsed.data.reviewNote,
        companyId: user.companyId,
      })
    }

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error: unknown) {
    console.error('[PATCH /api/access-requests/[id]]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
