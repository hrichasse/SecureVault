/**
 * GET|POST /api/admin/crm/companies/[id]/notes
 *
 * Notas / timeline del CRM para una empresa. Solo ADMIN del sistema.
 */

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getCompanyNotes, addCompanyNote } from '@/modules/crm/crm.service'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }
    const notes = await getCompanyNotes(params.id)
    return NextResponse.json({ data: notes }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/admin/crm/companies/[id]/notes]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    const { body } = (await request.json()) as { body?: string }
    if (!body || !body.trim()) {
      return NextResponse.json({ error: 'La nota no puede estar vacía' }, { status: 400 })
    }

    const note = await addCompanyNote({
      companyId: params.id,
      authorId: user.id,
      authorName: user.name,
      body,
    })
    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/crm/companies/[id]/notes]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
