/**
 * Incident Service — lógica de negocio para incidentes documentales.
 */

import { prisma } from '@/lib/prisma'
import type { IncidentStatus, IncidentPriority, IncidentType, ConfidentialityLevel } from '@/types'

// ── calcPriority ───────────────────────────────────────────

function getAutomaticPriority(level: ConfidentialityLevel | undefined): IncidentPriority {
  switch (level) {
    case 'CRITICO': return 'CRITICAL'
    case 'ALTO': return 'HIGH'
    case 'MEDIO': return 'MEDIUM'
    case 'BAJO': return 'LOW'
    default: return 'MEDIUM'
  }
}

// ── createIncident ─────────────────────────────────────────

export interface CreateIncidentInput {
  title: string
  description: string
  type: IncidentType
  documentId?: string
  priority?: IncidentPriority
}

export async function createIncident(
  data: CreateIncidentInput,
  createdById: string,
  companyId: string
) {
  let finalPriority = data.priority ?? 'MEDIUM'

  // Si hay documento, la prioridad del documento sobreescribe la enviada
  if (data.documentId) {
    const document = await prisma.document.findFirst({
      where: { id: data.documentId, companyId, status: { not: 'DELETED' } },
      select: { confidentialityLevel: true },
    })
    if (!document) throw new Error('Documento no encontrado o sin acceso')
    finalPriority = getAutomaticPriority(document.confidentialityLevel)
  }

  return prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: finalPriority,
        documentId: data.documentId,
        companyId,
        createdById,
        status: 'OPEN',
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'CREATE_INCIDENT',
        userId: createdById,
        companyId,
        documentId: data.documentId, // puede ser null
        metadata: {
          incidentId: incident.id,
          actionType: 'CREATE_INCIDENT',
          type: data.type,
          priority: finalPriority,
        },
      },
    })

    return incident
  })
}

// ── getIncidents ───────────────────────────────────────────

export interface GetIncidentsFilters {
  companyId: string
  status?: IncidentStatus
  priority?: IncidentPriority
  type?: IncidentType
  documentId?: string
}

export async function getIncidents({ companyId, ...filters }: GetIncidentsFilters) {
  return prisma.incident.findMany({
    where: {
      companyId,
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.type && { type: filters.type }),
      ...(filters.documentId && { documentId: filters.documentId }),
    },
    include: {
      document: { select: { id: true, name: true, confidentialityLevel: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ── getIncidentById ────────────────────────────────────────

export async function getIncidentById(id: string, companyId: string) {
  return prisma.incident.findFirst({
    where: { id, companyId },
    include: {
      document: { select: { id: true, name: true, confidentialityLevel: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })
}

// ── updateIncident ─────────────────────────────────────────

export interface UpdateIncidentInput {
  status?: IncidentStatus
  assignedToId?: string
  resolution?: string
}

export async function updateIncident(
  id: string,
  data: UpdateIncidentInput,
  userId: string,
  companyId: string
) {
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  })
  if (!existing) throw new Error('Incidente no encontrado')

  // Manejo automático de fechas de resolución
  let resolvedAt = existing.resolvedAt
  let closedAt = existing.closedAt

  if (data.status === 'RESOLVED' && existing.status !== 'RESOLVED') {
    resolvedAt = new Date()
  } else if (data.status !== 'RESOLVED' && data.status !== 'CLOSED') {
    resolvedAt = null // si lo reabren
  }

  if (data.status === 'CLOSED' && existing.status !== 'CLOSED') {
    closedAt = new Date()
    if (!resolvedAt) resolvedAt = new Date() // Si pasa directo a closed, también resolvió
  } else if (data.status !== 'CLOSED') {
    closedAt = null // si lo reabren
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id },
      data: {
        ...data,
        resolvedAt,
        closedAt,
        updatedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        action: data.status === 'CLOSED' ? 'CLOSE_INCIDENT' : 'UPDATE_INCIDENT',
        userId,
        companyId,
        documentId: updated.documentId,
        metadata: {
          incidentId: updated.id,
          actionType: data.status === 'CLOSED' ? 'CLOSE_INCIDENT' : 'UPDATE_INCIDENT',
          status: updated.status,
          assignedToId: updated.assignedToId,
        },
      },
    })

    return updated
  })
}
