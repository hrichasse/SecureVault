/**
 * consumers.ts — Arranca los consumidores del bus dentro del proceso de la app.
 *
 * Se invoca una vez al iniciar el servidor (src/instrumentation.ts). Cada
 * suscripción del topic queda escuchando y procesa sus mensajes con runner.ts.
 *
 * En desarrollo los receptores sobreviven al HMR (viven en globalThis junto al
 * cliente), así que un cambio en un handler requiere reiniciar el servidor.
 */

import { describeError, getBrokerFlavor, getBusClient, isMessagingEnabled } from './bus'
import { buildTopology, TOPIC_EVENTS } from './topology'
import { handleMessage, newStats, type ConsumerStats } from './runner'
import { SUBSCRIPTION_CONSUMERS } from './subscriptions'
import { publishEvent } from './publisher'
import { startRpcResponder } from './rpc'

interface ConsumersState {
  startedAt: string
  stats: Record<string, ConsumerStats>
}

export interface WorkerInfo {
  pid: number
  startedAt: string
  uptimeSeconds: number
  stats: Record<string, ConsumerStats>
}

const globalForConsumers = globalThis as unknown as { svConsumers?: ConsumersState }

const DEFAULT_RETRY_BASE_MS = 2_000

/** Estado del worker; es lo que responde al "ping" por request/reply. */
export function getWorkerInfo(): WorkerInfo | null {
  const state = globalForConsumers.svConsumers
  if (!state) return null
  return {
    pid: process.pid,
    startedAt: state.startedAt,
    uptimeSeconds: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000),
    stats: state.stats,
  }
}

export function startConsumers(): void {
  if (!isMessagingEnabled()) {
    console.log('[Messaging] SERVICEBUS_CONNECTION_STRING no configurada: los eventos se procesan en línea.')
    return
  }
  if (globalForConsumers.svConsumers) return

  const state: ConsumersState = { startedAt: new Date().toISOString(), stats: {} }
  globalForConsumers.svConsumers = state

  const client = getBusClient()
  const retryBaseMs = Number(process.env.MESSAGING_RETRY_BASE_MS) || DEFAULT_RETRY_BASE_MS

  for (const spec of buildTopology(getBrokerFlavor()).topic.subscriptions) {
    const consumer = SUBSCRIPTION_CONSUMERS[spec.name]
    if (!consumer) continue

    const stats = (state.stats[spec.name] = newStats())
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
  }

  startRpcResponder({ ping: () => getWorkerInfo() })

  console.log(
    `[Messaging] Consumidores activos (${getBrokerFlavor()}): ${Object.keys(state.stats).join(', ')} + rpc`
  )
}
