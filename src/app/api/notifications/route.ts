/**
 * GET   /api/notifications — avisos del usuario autenticado (para la campana).
 * PATCH /api/notifications — marca todos como leídos.
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { listNotifications, markAllNotificationsRead } from '@/modules/notifications/notification.service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    return NextResponse.json({ data: await listNotifications(user.id) })
  } catch (error) {
    console.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    return NextResponse.json({ data: { marked: await markAllNotificationsRead(user.id) } })
  } catch (error) {
    console.error('[PATCH /api/notifications]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
