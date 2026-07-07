/**
 * GET /api/admin/crm/overview
 *
 * KPIs globales del CRM + listado de empresas con health score y etapa.
 * Solo accesible para el ADMIN del sistema.
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getCrmOverview } from '@/modules/crm/crm.service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    const overview = await getCrmOverview()
    return NextResponse.json({ data: overview }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/admin/crm/overview]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
