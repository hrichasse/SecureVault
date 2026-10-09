/**
 * events.ts — Eventos de dominio que viajan por el topic de Service Bus.
 *
 * Los mensajes llevan solo identificadores (patrón claim-check): el consumidor
 * relee lo que necesita de la BD o de Storage. Así el mensaje es chico y no
 * arrastra datos sensibles por el broker.
 */

import { randomUUID } from 'crypto'
import type { EventType } from './topology'

export interface EventPayloads {
  'document.uploaded': {
    documentId: string
    companyId: string
    name: string
    confidentialityLevel: string
    uploadedById: string
  }
  'incident.created': {
    incidentId: string
    companyId: string
    title: string
    priority: string
    createdById: string
  }
  'access-request.created': {
    requestId: string
    companyId: string
    documentName: string
    requestedById: string
    requesterName: string
  }
  'access-request.reviewed': {
    requestId: string
    companyId: string
    documentId: string
    documentName: string
    requestedById: string
    status: 'APPROVED' | 'REJECTED'
  }
  'messaging.dead-lettered': {
    subscription: string
    eventId: string
    eventType: string
    reason: string
    description: string
  }
}

export interface EventEnvelope<T extends EventType = EventType> {
  /** Identidad del evento: es el messageId y la clave de idempotencia de los consumidores. */
  id: string
  type: T
  occurredAt: string
  data: EventPayloads[T]
}

export type AnyEventEnvelope = { [T in EventType]: EventEnvelope<T> }[EventType]

export function createEnvelope<T extends EventType>(type: T, data: EventPayloads[T]): EventEnvelope<T> {
  return { id: randomUUID(), type, occurredAt: new Date().toISOString(), data }
}
