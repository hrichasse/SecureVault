/**
 * runner.ts — Procesa un mensaje y lo confirma (ack) según el resultado.
 *
 * Modo peek-lock: el broker entrega el mensaje bloqueado y espera una
 * confirmación explícita. Si el proceso muere antes de confirmar, el bloqueo
 * vence y el mensaje se reentrega: por eso no se pierde trabajo.
 *
 *   handler OK              → complete    (se elimina de la cola)
 *   fallo transitorio       → abandon     (vuelve a la cola, tras un backoff)
 *   fallo permanente/último → dead-letter (va a la DLQ con motivo y descripción)
 *
 * Sin imports de la app: los handlers y el aviso de DLQ se inyectan.
 */

import type { ServiceBusReceivedMessage, ServiceBusReceiver } from '@azure/service-bus'
import { EVENT_TYPES, type EventType } from './topology'
import { decideSettlement, PermanentError } from './settlement'
import type { AnyEventEnvelope } from './events'

export type EventHandler = (event: AnyEventEnvelope) => Promise<void>

export interface ConsumerStats {
  processed: number
  retried: number
  deadLettered: number
  lastError?: string
  lastActivityAt?: string
}

export interface DeadLetterNotice {
  subscription: string
  eventId: string
  eventType: string
  reason: string
  description: string
}

export interface RunnerContext {
  subscription: string
  maxDeliveryCount: number
  handler: EventHandler
  stats: ConsumerStats
  /** Base del backoff entre reintentos. */
  retryBaseMs: number
  /** Se invoca después de mandar un mensaje a la DLQ (para alertar). */
  onDeadLetter?: (notice: DeadLetterNotice) => Promise<void>
}

/**
 * Propiedad que se graba en el mensaje al mandarlo a la DLQ: cuántas veces se
 * intentó procesar. El `deliveryCount` del broker no sirve para eso, porque en la
 * DLQ sigue subiendo cada vez que alguien recibe el mensaje para inspeccionarlo.
 */
export const ATTEMPTS_PROPERTY = 'attempts'

export function newStats(): ConsumerStats {
  return { processed: 0, retried: 0, deadLettered: 0 }
}

/** Valida que el cuerpo sea un evento conocido. Un mensaje mal formado nunca se arregla reintentando. */
export function parseEnvelope(body: unknown): AnyEventEnvelope {
  const candidate = body as Partial<AnyEventEnvelope> | null
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.id !== 'string' ||
    !EVENT_TYPES.includes(candidate.type as EventType) ||
    typeof candidate.data !== 'object' ||
    candidate.data === null
  ) {
    throw new PermanentError('MalformedMessage', 'El mensaje no es un evento válido de SecureVault')
  }
  return candidate as AnyEventEnvelope
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function handleMessage(
  receiver: ServiceBusReceiver,
  message: ServiceBusReceivedMessage,
  ctx: RunnerContext
): Promise<void> {
  const { subscription, stats } = ctx
  const label = `[Messaging] ${subscription} · ${message.subject ?? 'sin-tipo'} · ${message.messageId}`

  let failure: unknown
  let failed = false
  try {
    await ctx.handler(parseEnvelope(message.body))
  } catch (error) {
    failed = true
    failure = error
  }
  stats.lastActivityAt = new Date().toISOString()

  try {
    if (!failed) {
      await receiver.completeMessage(message)
      stats.processed++
      return
    }

    const decision = decideSettlement(failure, message.deliveryCount ?? 0, ctx.maxDeliveryCount, ctx.retryBaseMs)
    stats.lastError = failure instanceof Error ? failure.message : String(failure)

    if (decision.action === 'retry') {
      stats.retried++
      console.warn(
        `${label}: intento ${(message.deliveryCount ?? 0) + 1}/${ctx.maxDeliveryCount} falló (${stats.lastError}). Reintento en ${decision.delayMs}ms.`
      )
      // El backoff se espera reteniendo el bloqueo; al abandonar, el broker reentrega.
      await sleep(decision.delayMs)
      await receiver.abandonMessage(message)
      return
    }

    await receiver.deadLetterMessage(message, {
      deadLetterReason: decision.reason,
      deadLetterErrorDescription: decision.description,
      [ATTEMPTS_PROPERTY]: (message.deliveryCount ?? 0) + 1,
    })
    stats.deadLettered++
    console.error(`${label}: enviado a la DLQ (${decision.reason}): ${decision.description}`)

    await ctx.onDeadLetter?.({
      subscription,
      eventId: String(message.messageId ?? ''),
      eventType: message.subject ?? 'desconocido',
      reason: decision.reason,
      description: decision.description,
    })
  } catch (settleError) {
    // No se pudo confirmar (p. ej. venció el bloqueo). No hay que hacer nada más:
    // el broker volverá a entregar el mensaje.
    console.error(`${label}: no se pudo confirmar el mensaje; el broker lo reentregará.`, settleError)
  }
}
