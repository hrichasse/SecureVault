/**
 * POST /api/subscriptions/cancel
 *
 * Cancela la suscripción de pago de la empresa del usuario autenticado
 * haciendo un downgrade a FREE (no elimina la fila).
 *
 * Solo puede ejecutarla el ADMIN_COMPANY de la empresa o un ADMIN del sistema,
 * ya que es una acción de facturación.
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/modules/auth/auth.service'
import { cancelSubscription } from '@/modules/subscriptions/subscriptions.service'
import { logEvent } from '@/modules/audit/audit.service'

export async function POST() {
  // 1. Autenticar
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Autorizar — solo admins pueden cancelar la suscripción
  if (user.role !== 'ADMIN_COMPANY' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Solo un administrador de la empresa puede cancelar la suscripción.' },
      { status: 403 }
    )
  }

  // 3. Cancelar (downgrade a FREE)
  const result = await cancelSubscription(user.companyId)
  if (!result) {
    return NextResponse.json(
      { error: 'No hay una suscripción de pago activa para cancelar.' },
      { status: 400 }
    )
  }

  // 4. Auditar
  await logEvent({
    action: 'CANCEL_SUBSCRIPTION',
    userId: user.id,
    companyId: user.companyId,
    metadata: { downgradedTo: 'FREE' },
  })

  return NextResponse.json({ ok: true, plan: result.plan })
}
