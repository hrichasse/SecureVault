/**
 * Document Repository — operaciones Prisma para documentos.
 *
 * Separación de responsabilidades:
 * - Repository: acceso directo a BD (queries Prisma)
 * - Service: lógica de negocio (Storage, clasificación, audit)
 */

import { prisma } from '@/lib/prisma'
import type { ConfidentialityLevel, DocumentStatus } from '@/types'

// ── Tipos ───────────────────────────────────────────────────

export interface CreateDocumentInput {
  name: string
  originalName: string
  mimeType: string
  sizeBytes: number
  sha256Hash: string
  storagePath: string
  confidentialityLevel: ConfidentialityLevel
  classificationScore: number
  description?: string
  companyId: string
  uploadedById: string
}

export interface ListDocumentsOptions {
  companyId: string
  status?: DocumentStatus
  confidentialityLevel?: ConfidentialityLevel
  page?: number
  limit?: number
}

// ── Queries ─────────────────────────────────────────────────

export async function listDocuments(options: ListDocumentsOptions) {
  const { companyId, status, confidentialityLevel, page = 1, limit = 20 } = options
  const skip = (page - 1) * limit

  const where = {
    companyId,
    ...(status ? { status } : { status: { not: 'DELETED' as DocumentStatus } }),
    ...(confidentialityLevel && { confidentialityLevel }),
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { accessRequests: true, certifications: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ])

  return {
    documents,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: skip + limit < total,
    hasPrev: page > 1,
  }
}

export async function findDocumentById(id: string, companyId: string) {
  return prisma.document.findFirst({
    where: { id, companyId, status: { not: 'DELETED' } },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      certifications: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { certifiedBy: { select: { name: true } } },
      },
      accessRequests: {
        where: { status: 'PENDING' },
        include: {
          requestedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: {
        select: { accessRequests: true, certifications: true, auditLogs: true },
      },
    },
  })
}

export async function createDocument(data: CreateDocumentInput) {
  return prisma.document.create({
    data,
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function updateDocument(
  id: string,
  companyId: string,
  data: {
    description?: string
    confidentialityLevel?: ConfidentialityLevel
    status?: DocumentStatus
  }
) {
  return prisma.document.updateMany({
    where: { id, companyId },
    data,
  })
}

export async function softDeleteDocument(id: string, companyId: string) {
  return prisma.document.updateMany({
    where: { id, companyId },
    data: { status: 'DELETED' },
  })
}
