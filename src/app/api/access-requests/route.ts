import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { createRequest, getRequests } from '@/modules/access-requests/request.service'

const createSchema = z.object({
  documentId: z.string().min(1),
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres').max(500),
  requestedDurationDays: z.number().int().positive().max(365).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const requests = await getRequests({
      companyId: user.companyId,
      userId: user.id,
      role: user.role,
      status,
    })

    return NextResponse.json({ data: requests }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/access-requests]', error)
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

    const result = await createRequest({
      ...parsed.data,
      userId: user.id,
      companyId: user.companyId,
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/access-requests]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
