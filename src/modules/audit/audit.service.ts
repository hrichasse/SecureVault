/**
 * Audit Service — Lógica para listar y exportar eventos de auditoría.
 */
import { prisma } from '@/lib/prisma'
import type { AuditAction } from '@/types'

export interface GetAuditLogsParams {
  companyId: string
  page?: number
  limit?: number
  action?: AuditAction
  startDate?: string
  endDate?: string
  documentId?: string
}

export async function getAuditLogs({
  companyId,
  page = 1,
  limit = 20,
  action,
  startDate,
  endDate,
  documentId,
}: GetAuditLogsParams) {
  const skip = (page - 1) * limit

  // Construir clausula de filtro
  const whereClause: any = { companyId }
  if (action) whereClause.action = action
  if (documentId) whereClause.documentId = documentId
  
  if (startDate || endDate) {
    whereClause.createdAt = {}
    if (startDate) whereClause.createdAt.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // Incluir todo el día
      whereClause.createdAt.lte = end
    }
  }

  // Obtener logs y conteo total en paralelo
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: whereClause }),
  ])

  return {
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ── Dashboard Metrics ──

export async function getDashboardMetrics(companyId: string) {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalDocuments, pendingRequests, openIncidents, issuedCertifications] = await Promise.all([
    prisma.document.count({
      where: { companyId, status: { not: 'DELETED' } },
    }),
    prisma.accessRequest.count({
      where: { document: { companyId }, status: 'PENDING' },
    }),
    prisma.incident.count({
      where: { companyId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
    prisma.certification.count({
      where: { 
        document: { companyId }, 
        isValid: true,
        createdAt: { gte: firstDayOfMonth }
      },
    }),
  ])

  return {
    totalDocuments,
    pendingRequests,
    openIncidents,
    issuedCertifications,
  }
}

// ── Recent Activity ──

export async function getRecentActivity(companyId: string, limit = 10) {
  return prisma.auditLog.findMany({
    where: { companyId },
    include: {
      user: { select: { name: true } },
      document: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
