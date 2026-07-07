import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { updateCompanyStage, updateCompanyContact, computeHealthScore } from '@/modules/crm/crm.service'
import type { CompanyStage } from '@prisma/client'

const VALID_STAGES: CompanyStage[] = ['LEAD', 'ONBOARDING', 'ACTIVE', 'AT_RISK', 'CHURNED']

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Empresa (con conteo de documentos incluido) + señales de salud en paralelo,
    // minimizando round-trips a la BD.
    const [company, recentActivity, openIncidents] = await Promise.all([
      prisma.company.findUnique({
        where: { id: params.id },
        include: {
          subscription: true,
          _count: { select: { documents: true } },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
              _count: { select: { documents: true } },
            },
            orderBy: { role: 'asc' }, // ADMIN_COMPANY first usually if sorted alphabetically
          },
        },
      }),
      prisma.auditLog.count({ where: { companyId: params.id, createdAt: { gte: since } } }),
      prisma.incident.count({ where: { companyId: params.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ])

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const documents = company._count.documents
    const health = computeHealthScore({
      plan: company.subscription?.plan ?? 'FREE',
      users: company.users.length,
      documents,
      recentActivity,
      openIncidents,
    })

    return NextResponse.json({ data: { ...company, documentsCount: documents, health } }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/admin/crm/companies/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    const body = (await request.json()) as { stage?: string; phone?: string | null }

    // Validaciones
    if (body.stage !== undefined && !VALID_STAGES.includes(body.stage as CompanyStage)) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    }
    if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 })
    }

    if (body.stage !== undefined) {
      await updateCompanyStage(params.id, body.stage as CompanyStage)
    }
    if (body.phone !== undefined) {
      const trimmed = typeof body.phone === 'string' ? body.phone.trim() : null
      await updateCompanyContact(params.id, trimmed ? trimmed : null)
    }

    const updated = await prisma.company.findUnique({
      where: { id: params.id },
      select: { id: true, stage: true, phone: true },
    })
    return NextResponse.json({ data: updated }, { status: 200 })
  } catch (error) {
    console.error('[PATCH /api/admin/crm/companies/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
    }

    // Opcional: Verificaciones de seguridad antes de eliminar
    const company = await prisma.company.findUnique({ where: { id: params.id } })
    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    // Eliminar la empresa (Prisma cascade debería estar configurado o lo borramos manualmente si es necesario)
    // Para SecureVault, es mejor usar Soft Delete o estar muy seguros de que cascada funciona.
    // Asumiremos que el schema tiene set-up para cascada o usaremos transacción para limpiar datos.
    // Dado que es un proyecto básico, intentaremos el borrado directo.
    
    // Por seguridad en este boilerplate, no implementaremos la cascada profunda aquí si no está en Prisma.
    // Solo borraremos si tiene pocos usuarios/documentos o está vacío, o dejamos que Prisma falle si hay foreign keys.
    await prisma.company.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[DELETE /api/admin/crm/companies/[id]]', error)
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'No se puede eliminar la empresa porque tiene datos asociados (Documentos, Usuarios).' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno al eliminar la empresa' }, { status: 500 })
  }
}
