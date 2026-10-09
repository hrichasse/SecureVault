/**
 * subscriptions.ts — Qué hace cada suscripción del topic de eventos.
 *
 * Pub/sub: cada suscripción recibe su propia copia de los eventos que le
 * interesan (según el filtro definido en topology.ts) y los procesa de forma
 * independiente: si el indexador falla, las notificaciones siguen saliendo.
 */

import { SUB_INDEXER, SUB_NOTIFIER } from './topology'
import type { EventHandler } from './runner'
import { indexDocumentFromStorage } from '@/modules/documents/indexing.service'
import { notifyFromEvent } from '@/modules/notifications/notification.service'

export interface SubscriptionConsumer {
  handler: EventHandler
  /** Mensajes que se procesan en paralelo. */
  maxConcurrentCalls: number
}

export const SUBSCRIPTION_CONSUMERS: Record<string, SubscriptionConsumer> = {
  [SUB_INDEXER]: {
    // De a uno: la indexación llama a la API de embeddings, que tiene rate limit.
    maxConcurrentCalls: 1,
    handler: async (event) => {
      if (event.type !== 'document.uploaded') return
      const outcome = await indexDocumentFromStorage(event.data.documentId)
      console.log(`[Messaging] indexer: documento ${event.data.documentId} →`, JSON.stringify(outcome))
    },
  },
  [SUB_NOTIFIER]: {
    maxConcurrentCalls: 4,
    handler: async (event) => {
      await notifyFromEvent(event)
    },
  },
}
