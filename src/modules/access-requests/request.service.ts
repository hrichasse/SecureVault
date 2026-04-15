/**
 * Access Request Service — lógica de negocio para solicitudes de acceso.
 *
 * Flujo: crear → aprobar (crea permiso) / rechazar
 */

import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types'

// ── Utilidades ────────────────────────────────────────────

function addDays(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

// ── createRequest ─────────────────────────────────────────

export interface CreateRequestInput {
  documentId: string
  reason: string
  requestedDurationDays?: number
  userId: string
  companyId: string
}

export async function createRequest({
  documentId,
  reason,
  requestedDurationDays,
  userId,
  companyId,
}: CreateRequestInput) {
  // Verificar que el documento pertenece a la empresa
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId, status: { not: 'DELETED' } },
  })
  if (!document) throw new Error('Documento no encontrado')

  // Evitar solicitudes duplicadas pendientes
  const existing = await prisma.accessRequest.findFirst({
    where: { documentId, requestedById: userId, status: 'PENDING' },
  })
  if (existing) throw new Error('Ya tienes una solicitud pendiente para este documento')

  return prisma.$transaction(async (tx) => {
    const request = await tx.accessRequest.create({
      data: {
        documentId,
        requestedById: userId,
        reason,
        expiresAt: requestedDurationDays
          ? addDays(requestedDurationDays)
          : null,
        status: 'PENDING',
      },
      include: {
        document: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'REQUEST_ACCESS',
        userId,
        companyId,
        documentId,
        metadata: { reason, requestedDurationDays },
      },
    })

    return request
  })
}

// ── approveRequest ────────────────────────────────────────

export interface ApproveRequestInput {
  requestId: string
  reviewerId: string
  reviewNote?: string
  grantDurationDays?: number
  companyId: string
}

export async function approveRequest({
  requestId,
  reviewerId,
  reviewNote,
  grantDurationDays,
  companyId,
}: ApproveRequestInput) {
  const request = await prisma.accessRequest.findFirst({
    where: { id: requestId, status: 'PENDING' },
    include: { document: { select: { companyId: true, name: true } } },
  })

  if (!request) throw new Error('Solicitud no encontrada o ya procesada')
  if (request.document.companyId !== companyId)
    throw new Error('Sin permisos sobre esta solicitud')

  const expiresAt = grantDurationDays ? addDays(grantDurationDays) : null

  return prisma.$transaction(async (tx) => {
    // Actualizar solicitud
    const updated = await tx.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewNote: reviewNote || null,
        expiresAt,
        updatedAt: new Date(),
      },
    })

    // Crear o renovar DocumentPermission
    await tx.documentPermission.upsert({
      where: {
        documentId_userId: {
          documentId: request.documentId,
          userId: request.requestedById,
        },
      },
      create: {
        documentId: request.documentId,
        userId: request.requestedById,
        canRead: true,
        canDownload: true,
        expiresAt,
        createdFromRequest: requestId,
      },
      update: {
        canRead: true,
        canDownload: true,
        expiresAt,
        createdFromRequest: requestId,
      },
    })

    // AuditLog
    await tx.auditLog.create({
      data: {
        action: 'APPROVE_REQUEST',
        userId: reviewerId,
        companyId,
        documentId: request.documentId,
        metadata: { requestId, grantDurationDays, reviewNote },
      },
    })

    return updated
  })
}

// ── rejectRequest ─────────────────────────────────────────

export async function rejectRequest({
  requestId,
  reviewerId,
  reviewNote,
  companyId,
}: {
  requestId: string
  reviewerId: string
  reviewNote: string
  companyId: string
}) {
  const request = await prisma.accessRequest.findFirst({
    where: { id: requestId, status: 'PENDING' },
    include: { document: { select: { companyId: true } } },
  })

  if (!request) throw new Error('Solicitud no encontrada o ya procesada')
  if (request.document.companyId !== companyId)
    throw new Error('Sin permisos sobre esta solicitud')

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewNote,
        updatedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'REJECT_REQUEST',
        userId: reviewerId,
        companyId,
        documentId: request.documentId,
        metadata: { requestId, reviewNote },
      },
    })

    return updated
  })
}

// ── getRequests ───────────────────────────────────────────

export async function getRequests({
  companyId,
  userId,
  role,
  status,
}: {
  companyId: string
  userId: string
  role: UserRole
  status?: string
}) {
  const isReviewer = role === 'ADMIN' || role === 'ADMIN_COMPANY'

  return prisma.accessRequest.findMany({
    where: {
      ...(isReviewer
        ? { document: { companyId } } // ven todas las de la empresa
        : { requestedById: userId }), // solo las propias
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    },
    include: {
      document: { select: { id: true, name: true, confidentialityLevel: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

// ── hasActivePermission ───────────────────────────────────

export async function hasActivePermission(
  documentId: string,
  userId: string,
  role: UserRole
): Promise<boolean> {
  if (role === 'ADMIN' || role === 'ADMIN_COMPANY') return true

  const permission = await prisma.documentPermission.findFirst({
    where: {
      documentId,
      userId,
      canRead: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  return !!permission
}
