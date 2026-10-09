/**
 * GET  /api/admin/messaging — estado del bus: suscripciones, mensajes en cola y DLQ.
 * POST /api/admin/messaging — acciones del operador:
 *        { action: 'ping' }                                         request/reply contra el worker
 *        { action: 'reprocess' | 'discard', subscription, sequenceNumber }   gestión de la DLQ
 *
 * Solo para el ADMIN del sistema.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-utils'
import { getBrokerFlavor, isMessagingEnabled } from '@/lib/messaging/bus'
import { getSubscriptionsStatus, listDeadLetters, settleDeadLetter, PEEK_LIMIT } from '@/lib/messaging/dead-letter'
import { requestReply, RpcTimeoutError } from '@/lib/messaging/rpc'
import type { WorkerInfo } from '@/lib/messaging/consumers'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ping') }),
  z.object({
    action: z.enum(['reprocess', 'discard']),
    subscription: z.string().min(1),
    sequenceNumber: z.string().min(1),
  }),
])

async function requireSystemAdmin() {
  const user = await getAuthUser()
  return user && user.role === 'ADMIN' ? user : null
}

export async function GET() {
  try {
    if (!(await requireSystemAdmin())) {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    if (!isMessagingEnabled()) {
      return NextResponse.json({ data: { enabled: false } })
    }

    const [subscriptions, deadLetters] = await Promise.all([getSubscriptionsStatus(), listDeadLetters()])
    return NextResponse.json({
      data: { enabled: true, broker: getBrokerFlavor(), peekLimit: PEEK_LIMIT, subscriptions, deadLetters },
    })
  } catch (error) {
    console.error('[GET /api/admin/messaging]', error)
    return NextResponse.json({ error: 'No se pudo consultar el broker de mensajería' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireSystemAdmin())) {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }
    if (!isMessagingEnabled()) {
      return NextResponse.json({ error: 'La mensajería no está configurada en este entorno' }, { status: 409 })
    }

    const parsed = actionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    if (parsed.data.action === 'ping') {
      const startedAt = Date.now()
      try {
        const worker = await requestReply<WorkerInfo>('ping', undefined, 8_000)
        return NextResponse.json({ data: { roundTripMs: Date.now() - startedAt, worker } })
      } catch (error) {
        if (error instanceof RpcTimeoutError) {
          return NextResponse.json({ error: error.message }, { status: 504 })
        }
        throw error
      }
    }

    const result = await settleDeadLetter(parsed.data.subscription, parsed.data.sequenceNumber, parsed.data.action)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('[POST /api/admin/messaging]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación en el broker' }, { status: 502 })
  }
}
