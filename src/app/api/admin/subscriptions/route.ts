/**
 * PATCH /api/admin/subscriptions
 * GET /api/admin/subscriptions
 *
 * Gestión de suscripciones para el Administrador del Sistema.
 * Solo accesible para usuarios con rol ADMIN.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { upgradeSubscription } from '@/modules/subscriptions/subscriptions.service'
import type { SubscriptionPlan } from '@prisma/client'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { role: true },
  })

  if (dbUser?.role !== 'ADMIN') return null
  return dbUser
}

// GET — listar todas las suscripciones con datos de empresa
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const subscriptions = await prisma.subscription.findMany({
    include: {
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          _count: { select: { users: true, documents: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ subscriptions })
}

// PATCH — actualizar plan de una empresa
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { companyId, plan } = await request.json() as { companyId: string; plan: SubscriptionPlan }

  if (!companyId || !plan || !['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  const updated = await upgradeSubscription(companyId, plan, undefined, 'admin-manual')

  return NextResponse.json({ subscription: updated })
}
