/**
 * Global TypeScript types for SecureVault AI.
 */

// ==================== Roles y Niveles ====================

export type UserRole = 'ADMIN' | 'REVIEWER' | 'USER'

export type ConfidentialityLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'

// ==================== Estados de Documentos ====================

export type DocumentStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED'

// ==================== Estados de Solicitudes ====================

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// ==================== Incidentes ====================

export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// ==================== API Response Wrappers ====================

export interface ApiSuccess<T = unknown> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, string[]>
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ==================== Pagination ====================

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ==================== Auth ====================

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: UserRole
  companyId?: string
  companyName?: string
}

// ==================== Document ====================

export interface DocumentMeta {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  confidentiality: ConfidentialityLevel
  status: DocumentStatus
  hash: string
  uploadedAt: string | Date
  uploadedById: string
}

// ==================== Access Requests ====================

export interface AccessRequest {
  id: string
  documentId: string
  requestedById: string
  status: RequestStatus
  reason?: string
  createdAt: string | Date
  resolvedAt?: string | Date
}

// ==================== Incidents ====================

export interface Incident {
  id: string
  title: string
  description: string
  status: IncidentStatus
  priority: IncidentPriority
  reportedById: string
  documentId?: string
  createdAt: string | Date
  resolvedAt?: string | Date
}

// ==================== Certifications ====================

export interface Certification {
  id: string
  documentId: string
  verificationCode: string
  issuedAt: string | Date
  expiresAt?: string | Date
  isValid: boolean
}

import type { AuditAction } from '@prisma/client'
export type { AuditAction }


export interface AuditEntry {
  id: string
  action: AuditAction
  userId: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string | Date
}

// ==================== Dashboard Metrics ====================

export interface DashboardMetrics {
  totalDocuments: number
  pendingRequests: number
  openIncidents: number
  issuedCertifications: number
}
