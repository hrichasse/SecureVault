/**
 * subscriptions.service.ts — SecureVault AI
 *
 * Lógica de negocio para el sistema de suscripciones.
 * Maneja la creación, consulta y actualización de planes.
 */

import { prisma } from '@/lib/prisma'
import type { SubscriptionPlan } from '@prisma/client'

// ── Configuración de planes ────────────────────────────────────

export interface PlanConfig {
  plan: SubscriptionPlan
  label: string
  price: number         // CLP por mes (0 = gratis)
  maxUsers: number      // -1 = ilimitado
  maxDocuments: number  // -1 = ilimitado
  features: string[]
  durationDays: number  // días de validez del plan (30 = mensual)
}

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    plan: 'FREE',
    label: 'Gratuito',
    price: 0,
    maxUsers: 5,
    maxDocuments: 100,
    durationDays: 0,
    features: [
      'Hasta 5 usuarios',
      'Hasta 100 documentos',
      'Clasificación con IA',
      'Soporte por email',
    ],
  },
  PRO: {
    plan: 'PRO',
    label: 'Profesional',
    price: 29990,
    maxUsers: 25,
    maxDocuments: 1000,
    durationDays: 30,
    features: [
      'Hasta 25 usuarios',
      'Hasta 1.000 documentos',
      'Clasificación con IA',
      'Certificaciones notariales',
      'Auditoría avanzada',
      'Soporte por email y chat',
    ],
  },
  ENTERPRISE: {
    plan: 'ENTERPRISE',
    label: 'Empresarial',
    price: 0, // Contactar
    maxUsers: -1,
    maxDocuments: -1,
    durationDays: 30,
    features: [
      'Usuarios ilimitados',
      'Documentos ilimitados',
      'Clasificación con IA',
      'Certificaciones notariales',
      'Auditoría avanzada',
      'API personalizada',
      'SLA garantizado',
      'Soporte dedicado 24/7',
    ],
  },
}

// ── Funciones del servicio ────────────────────────────────────

/**
 * Obtiene la suscripción actual de una empresa.
 * Si no existe, retorna null.
 */
export async function getCompanySubscription(companyId: string) {
  return prisma.subscription.findUnique({
    where: { companyId },
  })
}

/**
 * Crea una suscripción FREE por defecto al registrar una empresa.
 * Si ya existe, no hace nada.
 */
export async function createDefaultSubscription(companyId: string) {
  const existing = await prisma.subscription.findUnique({ where: { companyId } })
  if (existing) return existing

  return prisma.subscription.create({
    data: {
      companyId,
      plan: 'FREE',
      status: 'ACTIVE',
      maxUsers: PLAN_CONFIG.FREE.maxUsers,
      maxDocuments: PLAN_CONFIG.FREE.maxDocuments,
    },
  })
}

/**
 * Actualiza el plan de una empresa (usada después de un pago exitoso con Transbank,
 * o manualmente por el ADMIN del sistema).
 */
export async function upgradeSubscription(
  companyId: string,
  plan: SubscriptionPlan,
  tbkToken?: string,
  tbkOrderId?: string
) {
  const config = PLAN_CONFIG[plan]
  const expiresAt = config.durationDays > 0
    ? new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000)
    : null

  return prisma.subscription.upsert({
    where: { companyId },
    update: {
      plan,
      status: 'ACTIVE',
      maxUsers: config.maxUsers,
      maxDocuments: config.maxDocuments,
      expiresAt,
      tbkToken: tbkToken ?? undefined,
      tbkOrderId: tbkOrderId ?? undefined,
    },
    create: {
      companyId,
      plan,
      status: 'ACTIVE',
      maxUsers: config.maxUsers,
      maxDocuments: config.maxDocuments,
      expiresAt,
      tbkToken: tbkToken ?? undefined,
      tbkOrderId: tbkOrderId ?? undefined,
    },
  })
}

/**
 * Retorna la configuración del plan actual de una empresa.
 * Si no tiene suscripción, retorna los límites FREE.
 */
export async function getPlanConfig(companyId: string): Promise<PlanConfig> {
  const sub = await getCompanySubscription(companyId)
  const plan: SubscriptionPlan = sub?.plan ?? 'FREE'
  return PLAN_CONFIG[plan]
}

/**
 * Verifica si una empresa puede añadir más usuarios según su plan.
 */
export async function canAddUser(companyId: string): Promise<boolean> {
  const [sub, userCount] = await Promise.all([
    getCompanySubscription(companyId),
    prisma.user.count({ where: { companyId } }),
  ])
  const maxUsers = sub?.maxUsers ?? PLAN_CONFIG.FREE.maxUsers
  return maxUsers === -1 || userCount < maxUsers
}

/**
 * Verifica si una empresa puede añadir más documentos según su plan.
 */
export async function canAddDocument(companyId: string): Promise<boolean> {
  const [sub, docCount] = await Promise.all([
    getCompanySubscription(companyId),
    prisma.document.count({ where: { companyId } }),
  ])
  const maxDocuments = sub?.maxDocuments ?? PLAN_CONFIG.FREE.maxDocuments
  return maxDocuments === -1 || docCount < maxDocuments
}
