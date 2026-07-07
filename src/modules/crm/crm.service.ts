/**
 * crm.service.ts — SecureVault AI
 *
 * Lógica del CRM para el ADMIN del sistema: métricas globales (KPIs),
 * "health score" por empresa, pipeline (etapas) y notas/timeline.
 */

import { prisma } from '@/lib/prisma'
import type { CompanyStage, SubscriptionPlan } from '@prisma/client'

// ── Precios mensuales (CLP) para estimar MRR ──────────────────
// PRO/ENTERPRISE se cobran; FREE no aporta ingresos.
const MRR_PRICE: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 29990,
  ENTERPRISE: 99990,
}

const ACTIVITY_WINDOW_DAYS = 30

// ── Health Score ──────────────────────────────────────────────

export interface HealthBreakdown {
  activity: number   // 0-30
  usage: number      // 0-35
  plan: number       // 0-35
  incidentPenalty: number // 0..-15
}

export interface HealthScore {
  score: number      // 0-100
  label: 'Excelente' | 'Buena' | 'Regular' | 'En riesgo'
  breakdown: HealthBreakdown
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/**
 * Calcula el puntaje de salud (0-100) de una empresa a partir de señales
 * que ya existen en el sistema:
 *  - actividad reciente (eventos de auditoría en los últimos 30 días)
 *  - volumen de uso (usuarios + documentos)
 *  - plan contratado (las de pago pesan más)
 *  - incidentes abiertos (penalización)
 */
export function computeHealthScore(input: {
  plan: SubscriptionPlan
  users: number
  documents: number
  recentActivity: number
  openIncidents: number
}): HealthScore {
  const { plan, users, documents, recentActivity, openIncidents } = input

  // Umbrales pensados para cuentas B2B pequeñas (saturan pronto).
  // Actividad (0-30): saturando en 8 eventos de auditoría en 30 días
  const activity = (clamp(recentActivity, 0, 8) / 8) * 30

  // Uso (0-35): documentos (0-22, satura en 6) + usuarios (0-13, satura en 4)
  const usage = (clamp(documents, 0, 6) / 6) * 22 + (clamp(users, 0, 4) / 4) * 13

  // Plan (0-35): las cuentas de pago son señal fuerte de salud/retención
  const planBonus = plan === 'ENTERPRISE' ? 35 : plan === 'PRO' ? 25 : 0

  // Incidentes abiertos: -8 c/u hasta -15
  const incidentPenalty = -clamp(openIncidents * 8, 0, 15)

  const score = Math.round(clamp(activity + usage + planBonus + incidentPenalty, 0, 100))

  const label: HealthScore['label'] =
    score >= 75 ? 'Excelente' : score >= 50 ? 'Buena' : score >= 30 ? 'Regular' : 'En riesgo'

  return {
    score,
    label,
    breakdown: {
      activity: Math.round(activity),
      usage: Math.round(usage),
      plan: planBonus,
      incidentPenalty: Math.round(incidentPenalty),
    },
  }
}

// ── Overview (KPIs + empresas con health/stage) ───────────────

export interface CrmCompany {
  id: string
  name: string
  rut: string | null
  phone: string | null
  stage: CompanyStage
  createdAt: Date
  plan: SubscriptionPlan
  subscriptionStatus: string | null
  users: number
  documents: number
  health: HealthScore
}

export interface CrmKpis {
  totalCompanies: number
  paidCompanies: number
  freeCompanies: number
  estimatedMrr: number
  totalUsers: number
  totalDocuments: number
  expiringSoon: number   // suscripciones que vencen en <= 14 días
  atRisk: number         // empresas en etapa AT_RISK
}

export interface CrmOverview {
  kpis: CrmKpis
  companies: CrmCompany[]
}

/**
 * Devuelve todo lo necesario para el panel CRM en una sola pasada,
 * evitando N+1: agrega actividad e incidentes por empresa con groupBy.
 */
export async function getCrmOverview(): Promise<CrmOverview> {
  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const [companies, activityByCompany, openIncidentsByCompany] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { select: { plan: true, status: true, expiresAt: true } },
        _count: { select: { users: true, documents: true } },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['companyId'],
      where: { createdAt: { gte: since }, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.incident.groupBy({
      by: ['companyId'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      _count: { _all: true },
    }),
  ])

  const activityMap = new Map(activityByCompany.map((a) => [a.companyId, a._count._all]))
  const incidentMap = new Map(openIncidentsByCompany.map((i) => [i.companyId, i._count._all]))

  let estimatedMrr = 0
  let paidCompanies = 0
  let totalUsers = 0
  let totalDocuments = 0
  let expiringSoon = 0
  let atRisk = 0

  const mapped: CrmCompany[] = companies.map((c) => {
    const plan = c.subscription?.plan ?? 'FREE'
    const recentActivity = activityMap.get(c.id) ?? 0
    const openIncidents = incidentMap.get(c.id) ?? 0

    const health = computeHealthScore({
      plan,
      users: c._count.users,
      documents: c._count.documents,
      recentActivity,
      openIncidents,
    })

    // KPIs acumulados
    estimatedMrr += MRR_PRICE[plan]
    if (plan !== 'FREE') paidCompanies += 1
    totalUsers += c._count.users
    totalDocuments += c._count.documents
    if (c.stage === 'AT_RISK') atRisk += 1
    if (
      c.subscription?.expiresAt &&
      c.subscription.expiresAt > new Date() &&
      c.subscription.expiresAt <= in14Days
    ) {
      expiringSoon += 1
    }

    return {
      id: c.id,
      name: c.name,
      rut: c.rut,
      phone: c.phone,
      stage: c.stage,
      createdAt: c.createdAt,
      plan,
      subscriptionStatus: c.subscription?.status ?? null,
      users: c._count.users,
      documents: c._count.documents,
      health,
    }
  })

  return {
    kpis: {
      totalCompanies: companies.length,
      paidCompanies,
      freeCompanies: companies.length - paidCompanies,
      estimatedMrr,
      totalUsers,
      totalDocuments,
      expiringSoon,
      atRisk,
    },
    companies: mapped,
  }
}

// ── Pipeline (etapa) y contacto ───────────────────────────────

export async function updateCompanyStage(companyId: string, stage: CompanyStage) {
  return prisma.company.update({ where: { id: companyId }, data: { stage } })
}

export async function updateCompanyContact(companyId: string, phone: string | null) {
  return prisma.company.update({ where: { id: companyId }, data: { phone } })
}

// ── Notas / timeline ──────────────────────────────────────────

export async function getCompanyNotes(companyId: string) {
  return prisma.companyNote.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addCompanyNote(input: {
  companyId: string
  authorId: string
  authorName: string
  body: string
}) {
  return prisma.companyNote.create({
    data: {
      companyId: input.companyId,
      authorId: input.authorId,
      authorName: input.authorName,
      body: input.body.trim(),
    },
  })
}
