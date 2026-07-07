/**
 * GET /api/dashboard/summary
 *
 * Devuelve en UNA sola llamada las métricas y la actividad reciente del dashboard,
 * autenticando una sola vez. Reemplaza los 5 fetches separados que hacía la página
 * (cada uno revalidaba la sesión contra Supabase), reduciendo drásticamente la
 * latencia de carga.
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getDashboardMetrics, getRecentActivity } from '@/modules/audit/audit.service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const [metrics, activity] = await Promise.all([
      getDashboardMetrics(user.companyId),
      getRecentActivity(user.companyId, 5),
    ])

    return NextResponse.json({ data: { metrics, activity } }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/dashboard/summary]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
