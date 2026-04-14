/**
 * Audit Module — barrel export
 */

export type { AuditAction, AuditEntry } from '@/types'
export { logEvent } from './audit.service'
export type { LogEventInput } from './audit.service'
