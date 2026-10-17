/**
 * dead-letter.ts — Inspección y gestión de la cola de mensajes muertos (DLQ).
 *
 * Cada suscripción tiene su propia DLQ ("$DeadLetterQueue"). Ahí terminan los
 * mensajes que agotaron sus reintentos, los que fallaron con un error
 * permanente y los que expiraron sin ser consumidos.
 *
 * Los conteos se obtienen con `peek` (leer sin bloquear ni consumir), que
 * funciona igual en Azure y en el emulador.
 */

import type { ServiceBusReceivedMessage, ServiceBusReceiver } from '@azure/service-bus'
import Long from 'long'
import { getBrokerFlavor, getBusClient } from './bus'
import { buildTopology, SUB_NOTIFIER, TOPIC_EVENTS, type SubscriptionSpec } from './topology'
import { ATTEMPTS_PROPERTY, parseEnvelope } from './runner'
import { SUBSCRIPTION_CONSUMERS } from './subscriptions'

/** Tope de mensajes que se miran por cola; el panel muestra "N+" al alcanzarlo. */
export const PEEK_LIMIT = 50

export interface SubscriptionStatus {
  name: string
  subjects: string[]
  maxDeliveryCount: number
  lockDuration: string
  timeToLive: string
  active: number
  deadLettered: number
}

export interface DeadLetterItem {
  subscription: string
  sequenceNumber: string
  messageId: string
  eventType: string
  reason: string
  description: string
  /** Veces que se intentó procesar (0: expiró en la cola sin llegar a entregarse). */
  attempts: number
  /** Quién lo mandó a la DLQ: un consumidor de la app, o el propio broker (venció o nadie lo confirmó). */
  deadLetteredBy: 'app' | 'broker'
  enqueuedAt: string | null
  body: unknown
}

const globalForDlq = globalThis as unknown as {
  svInspectors?: Map<string, ServiceBusReceiver>
  svDlqLocks?: Map<string, Promise<unknown>>
  /** Mensajes de la DLQ que ya generaron alerta en este proceso. */
  svAlertedDeadLetters?: Set<string>
}

function subscriptionSpecs(): SubscriptionSpec[] {
  return buildTopology(getBrokerFlavor()).topic.subscriptions
}

export function isKnownSubscription(name: string): boolean {
  return subscriptionSpecs().some((s) => s.name === name)
}

/**
 * Receptor de inspección por cola, creado una vez y reutilizado. Abrir y cerrar
 * un enlace por cada consulta del panel es caro y los brokers lo penalizan.
 */
function inspector(subscription: string, deadLetter: boolean): ServiceBusReceiver {
  const cache = (globalForDlq.svInspectors ??= new Map())
  const key = `${subscription}:${deadLetter ? 'dlq' : 'active'}`
  let receiver = cache.get(key)
  if (!receiver || receiver.isClosed) {
    receiver = getBusClient().createReceiver(
      TOPIC_EVENTS,
      subscription,
      deadLetter ? { subQueueType: 'deadLetter' } : undefined
    )
    cache.set(key, receiver)
  }
  return receiver
}

/**
 * `peek` recuerda dónde quedó la lectura anterior y continúa desde ahí. Para
 * obtener siempre la foto completa se lee explícitamente desde el inicio.
 */
function peek(subscription: string, deadLetter: boolean): Promise<ServiceBusReceivedMessage[]> {
  return inspector(subscription, deadLetter).peekMessages(PEEK_LIMIT, { fromSequenceNumber: Long.ZERO })
}

export async function getSubscriptionsStatus(): Promise<SubscriptionStatus[]> {
  return Promise.all(
    subscriptionSpecs().map(async (spec) => {
      const [active, dead] = await Promise.all([peek(spec.name, false), peek(spec.name, true)])
      return {
        name: spec.name,
        subjects: spec.subjects,
        maxDeliveryCount: spec.maxDeliveryCount,
        lockDuration: spec.lockDuration,
        timeToLive: spec.defaultMessageTimeToLive,
        active: active.length,
        deadLettered: dead.length,
      }
    })
  )
}

function attemptsOf(message: ServiceBusReceivedMessage): number {
  return Number(message.applicationProperties?.[ATTEMPTS_PROPERTY] ?? 0)
}

export async function listDeadLetters(): Promise<DeadLetterItem[]> {
  const perSubscription = await Promise.all(
    subscriptionSpecs().map(async (spec) => {
      const messages = await peek(spec.name, true)
      return messages.map((m) => ({
        subscription: spec.name,
        sequenceNumber: String(m.sequenceNumber),
        messageId: String(m.messageId ?? ''),
        eventType: m.subject ?? 'desconocido',
        reason: m.deadLetterReason ?? 'Desconocido',
        description: m.deadLetterErrorDescription ?? '',
        attempts: attemptsOf(m),
        // Solo los consumidores de la app graban esta propiedad al mandar un mensaje a la DLQ.
        deadLetteredBy: m.applicationProperties?.[ATTEMPTS_PROPERTY] === undefined ? ('broker' as const) : ('app' as const),
        enqueuedAt: m.enqueuedTimeUtc?.toISOString() ?? null,
        body: m.body,
      }))
    })
  )
  return perSubscription.flat()
}

/**
 * Alerta de los mensajes que el propio broker mandó a la DLQ.
 *
 * Cuando un consumidor manda un mensaje a la DLQ, la alerta sale en ese momento
 * (onDeadLetter en consumers.ts). Pero el broker también mueve mensajes por su
 * cuenta: los que vencen sin consumirse (TTL) y los que nadie confirmó antes de
 * agotar las entregas (por ejemplo, porque el proceso murió procesándolos). Esos
 * no pasan por ningún consumidor, así que se detectan revisando la DLQ.
 *
 * La alerta se entrega directo al handler de notificaciones, sin pasar por el
 * topic: avisar de un problema del bus no debe depender del bus. Su id es fijo
 * por mensaje, así que revisar varias veces no duplica avisos.
 *
 * @returns cuántas alertas nuevas se generaron.
 */
export async function alertBrokerDeadLetters(): Promise<number> {
  const notify = SUBSCRIPTION_CONSUMERS[SUB_NOTIFIER]?.handler
  if (!notify) return 0

  const alerted = (globalForDlq.svAlertedDeadLetters ??= new Set())
  let raised = 0
  for (const item of await listDeadLetters()) {
    const id = `dlq:${item.subscription}:${item.sequenceNumber}:${item.messageId}`
    if (item.deadLetteredBy !== 'broker' || alerted.has(id)) continue

    await notify(
      {
        id,
        type: 'messaging.dead-lettered',
        occurredAt: new Date().toISOString(),
        data: {
          subscription: item.subscription,
          eventId: item.messageId,
          eventType: item.eventType,
          reason: item.reason,
          description: item.description,
        },
      },
      { deliveryCount: 0 }
    )
    alerted.add(id)
    raised++
  }
  return raised
}

export type DeadLetterAction = 'reprocess' | 'discard'
export type DeadLetterResult = { ok: true } | { ok: false; error: string }

/** Un receptor no admite dos recepciones a la vez: las operaciones sobre una misma DLQ van en fila. */
function oneAtATime<T>(subscription: string, operation: () => Promise<T>): Promise<T> {
  const locks = (globalForDlq.svDlqLocks ??= new Map())
  const result = (locks.get(subscription) ?? Promise.resolve()).then(operation, operation)
  locks.set(subscription, result.catch(() => {}))
  return result
}

/**
 * Reprocesa o descarta un mensaje de la DLQ.
 *
 * Reprocesar ejecuta el handler de esa suscripción aquí mismo, en vez de
 * republicar al topic: republicar entregaría el evento otra vez a todas las
 * suscripciones, no solo a la que falló. Si el handler vuelve a fallar, el
 * mensaje se queda en la DLQ y se devuelve el error al operador.
 */
export async function settleDeadLetter(
  subscription: string,
  sequenceNumber: string,
  action: DeadLetterAction
): Promise<DeadLetterResult> {
  if (!isKnownSubscription(subscription)) return { ok: false, error: 'Suscripción desconocida' }

  return oneAtATime(subscription, async () => {
    const receiver = inspector(subscription, true)
    const batch = await receiver.receiveMessages(PEEK_LIMIT, { maxWaitTimeInMs: 3_000 })
    const target = batch.find((m) => String(m.sequenceNumber) === sequenceNumber)

    // Los demás mensajes del lote vuelven a la DLQ tal cual.
    await Promise.all(batch.filter((m) => m !== target).map((m) => receiver.abandonMessage(m)))
    if (!target) return { ok: false, error: 'El mensaje ya no está en la DLQ' }

    if (action === 'reprocess') {
      try {
        await SUBSCRIPTION_CONSUMERS[subscription].handler(parseEnvelope(target.body), {
          deliveryCount: attemptsOf(target),
          reprocess: true,
        })
      } catch (error) {
        // Vuelve a la DLQ, contando este intento.
        await receiver.abandonMessage(target, { [ATTEMPTS_PROPERTY]: attemptsOf(target) + 1 })
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    await receiver.completeMessage(target)
    return { ok: true }
  })
}
