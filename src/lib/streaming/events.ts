/**
 * events.ts — Eventos de negocio que viajan por el topic de Kafka.
 *
 * Cada acción relevante del sistema (subir o ver un documento, pedir acceso,
 * reportar un incidente, certificar...) se publica como un evento en el topic
 * `securevault.eventos-negocio`. Los consumidores calculan métricas en tiempo
 * real sobre ese flujo continuo.
 *
 * La clave del mensaje es el companyId: Kafka asigna la partición por clave, así
 * que los eventos de una misma empresa llegan siempre en orden.
 *
 * Sin imports de la app: los scripts (productores y consumidores) lo cargan sin
 * levantar Next ni Prisma.
 */
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { EVENT_LABELS as LABELS } from './labels'

/** Tipos de evento: los mismos nombres que AuditAction en la BD. */
export const BUSINESS_EVENT_TYPES = [
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'UPLOAD_DOCUMENT',
  'VIEW_DOCUMENT',
  'DELETE_DOCUMENT',
  'REQUEST_ACCESS',
  'APPROVE_REQUEST',
  'REJECT_REQUEST',
  'CREATE_INCIDENT',
  'UPDATE_INCIDENT',
  'CLOSE_INCIDENT',
  'CERTIFY_DOCUMENT',
  'VERIFY_DOCUMENT',
  'GRANT_PERMISSION',
  'REVOKE_PERMISSION',
  'CANCEL_SUBSCRIPTION',
] as const

export type BusinessEventType = (typeof BUSINESS_EVENT_TYPES)[number]

export const CONFIDENTIALITY_LEVELS = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number]

/** Etiquetas en español para mostrar en consola y en el panel. */
export const EVENT_LABELS: Record<BusinessEventType, string> = LABELS

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(BUSINESS_EVENT_TYPES),
  occurredAt: z.string().datetime(),
  /** 'app' = acción real (relay de la tabla AuditLog); 'simulator' = generado para la demo */
  source: z.enum(['app', 'simulator']),
  companyId: z.string().min(1),
  companyName: z.string().optional(),
  userId: z.string().nullable().optional(),
  userName: z.string().optional(),
  documentId: z.string().nullable().optional(),
  documentName: z.string().optional(),
  confidentialityLevel: z.enum(CONFIDENTIALITY_LEVELS).nullable().optional(),
  /** Prioridad del incidente (solo CREATE_INCIDENT) */
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable().optional(),
})

export type BusinessEvent = z.infer<typeof eventSchema>

export function createBusinessEvent(
  data: Omit<BusinessEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }
): BusinessEvent {
  return eventSchema.parse({
    ...data,
    id: data.id ?? randomUUID(),
    occurredAt: data.occurredAt ?? new Date().toISOString(),
  })
}

/**
 * Lee el valor de un mensaje de Kafka. Devuelve null si no es un evento válido
 * (un mensaje mal formado no debe tumbar al consumidor).
 */
export function parseBusinessEvent(value: Buffer | string | null | undefined): BusinessEvent | null {
  if (value == null) return null
  try {
    const parsed = eventSchema.safeParse(JSON.parse(value.toString()))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
