/**
 * consumers.ts — Arranca los consumidores del bus dentro del proceso de la app.
 *
 * Se invoca una vez al iniciar el servidor (src/instrumentation.ts). Cada
 * suscripción del topic queda escuchando y procesa sus mensajes con runner.ts.
 *
 * En desarrollo los receptores sobreviven al HMR (viven en globalThis junto al
 * cliente), así que un cambio en un handler requiere reiniciar el servidor.
 */

import type { ServiceBusReceiver } from '@azure/service-bus'
import { describeError, getBrokerFlavor, getBusClient, isMessagingEnabled } from './bus'
import { buildTopology, TOPIC_EVENTS } from './topology'
import { handleMessage, newStats, type ConsumerStats } from './runner'
import { SUBSCRIPTION_CONSUMERS } from './subscriptions'
import { publishEvent } from './publisher'
import { startRpcResponder } from './rpc'
import { alertBrokerDeadLetters } from './dead-letter'

interface ConsumersState {
  startedAt: string
  stats: Record<string, ConsumerStats>
  /** Receptores de las suscripciones del topic (el de request/reply va aparte). */
  receivers: ServiceBusReceiver[]
  /** Si están en pausa (modo demostración), hasta cuándo como máximo. */
  pausedUntil?: number
  resumeTimer?: NodeJS.Timeout
}

export interface WorkerInfo {
  pid: number
  startedAt: string
  uptimeSeconds: number
  stats: Record<string, ConsumerStats>
  /** Fecha (ISO) en que se reanudan solos si están en pausa; null si están activos. */
  pausedUntil: string | null
}

const globalForConsumers = globalThis as unknown as { svConsumers?: ConsumersState }

const DEFAULT_RETRY_BASE_MS = 2_000
/** Cada cuánto se busca en la DLQ lo que movió el propio broker (ver alertBrokerDeadLetters). */
const DLQ_SCAN_INTERVAL_MS = 15_000
/** Tope de una pausa: si nadie los reanuda, los consumidores vuelven solos. */
const MAX_PAUSE_MS = 5 * 60_000

/** Estado del worker; es lo que responde al "ping" por request/reply. */
export function getWorkerInfo(): WorkerInfo | null {
  const state = globalForConsumers.svConsumers
  if (!state) return null
  return {
    pid: process.pid,
    startedAt: state.startedAt,
    uptimeSeconds: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000),
    stats: state.stats,
    pausedUntil: state.pausedUntil ? new Date(state.pausedUntil).toISOString() : null,
  }
}

/** Crea un receptor por suscripción y lo deja escuchando. */
function subscribeAll(state: ConsumersState): void {
  const client = getBusClient()
  const retryBaseMs = Number(process.env.MESSAGING_RETRY_BASE_MS) || DEFAULT_RETRY_BASE_MS

  for (const spec of buildTopology(getBrokerFlavor()).topic.subscriptions) {
    const consumer = SUBSCRIPTION_CONSUMERS[spec.name]
    if (!consumer) continue

    // Las estadísticas sobreviven a las pausas.
    const stats = (state.stats[spec.name] ??= newStats())
    const receiver = client.createReceiver(TOPIC_EVENTS, spec.name)

    receiver.subscribe(
      {
        processMessage: (message) =>
          handleMessage(receiver, message, {
            subscription: spec.name,
            maxDeliveryCount: spec.maxDeliveryCount,
            handler: consumer.handler,
            stats,
            retryBaseMs,
            // Alerta: un mensaje en la DLQ se avisa a los administradores del
            // sistema. La propia alerta no genera otra alerta si falla (evita un ciclo).
            onDeadLetter: async (notice) => {
              if (notice.eventType === 'messaging.dead-lettered') return
              await publishEvent('messaging.dead-lettered', notice)
            },
          }),
        processError: async (args) => {
          console.error(`[Messaging] ${spec.name}: error del receptor (${args.errorSource}): ${describeError(args.error)}`)
        },
      },
      // El ack lo hace runner.ts de forma explícita según el resultado del handler.
      { autoCompleteMessages: false, maxConcurrentCalls: consumer.maxConcurrentCalls }
    )
    state.receivers.push(receiver)
  }
}

export function startConsumers(): void {
  if (!isMessagingEnabled()) {
    console.log('[Messaging] SERVICEBUS_CONNECTION_STRING no configurada: los eventos se procesan en línea.')
    return
  }
  if (globalForConsumers.svConsumers) return

  const state: ConsumersState = { startedAt: new Date().toISOString(), stats: {}, receivers: [] }
  globalForConsumers.svConsumers = state

  subscribeAll(state)
  startRpcResponder({ ping: () => getWorkerInfo() })

  setInterval(async () => {
    try {
      const raised = await alertBrokerDeadLetters()
      if (raised > 0) console.warn(`[Messaging] ${raised} mensaje(s) que el broker movió a la DLQ: alerta enviada`)
    } catch (error) {
      console.error(`[Messaging] no se pudo revisar la DLQ: ${describeError(error)}`)
    }
  }, DLQ_SCAN_INTERVAL_MS).unref()

  console.log(
    `[Messaging] Consumidores activos (${getBrokerFlavor()}): ${Object.keys(state.stats).join(', ')} + rpc`
  )
}

/**
 * Modo demostración: deja de consumir del topic (las peticiones síncronas siguen
 * respondiéndose). Lo que se publique mientras tanto queda guardado en el broker
 * y se procesa al reanudar. Afecta solo a esta instancia de la app.
 *
 * @returns false si no había consumidores o ya estaban en pausa.
 */
export async function pauseConsumers(): Promise<boolean> {
  const state = globalForConsumers.svConsumers
  if (!state || state.pausedUntil) return false

  state.pausedUntil = Date.now() + MAX_PAUSE_MS
  state.resumeTimer = setTimeout(resumeConsumers, MAX_PAUSE_MS)
  state.resumeTimer.unref()
  await Promise.all(state.receivers.splice(0).map((receiver) => receiver.close().catch(() => {})))
  console.warn('[Messaging] consumidores en pausa (modo demostración)')
  return true
}

/** @returns false si no estaban en pausa. */
export function resumeConsumers(): boolean {
  const state = globalForConsumers.svConsumers
  if (!state?.pausedUntil) return false

  clearTimeout(state.resumeTimer)
  state.pausedUntil = undefined
  subscribeAll(state)
  console.warn('[Messaging] consumidores reanudados')
  return true
}
