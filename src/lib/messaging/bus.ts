/**
 * bus.ts — Conexión a Azure Service Bus.
 *
 * Un solo ServiceBusClient por proceso (una conexión AMQP compartida por todos
 * los senders y receivers). Se guarda en globalThis por el mismo motivo que el
 * cliente de Prisma: en desarrollo el HMR recarga módulos y abriría conexiones
 * nuevas en cada recarga.
 *
 * Sin SERVICEBUS_CONNECTION_STRING la mensajería queda deshabilitada y los
 * eventos se procesan en línea (ver publisher.ts).
 */

import { RetryMode, ServiceBusClient, type ServiceBusSender } from '@azure/service-bus'
import { TOPIC_EVENTS, flavorFromConnectionString, type BrokerFlavor } from './topology'

const globalForBus = globalThis as unknown as {
  svBusClient?: ServiceBusClient
  svEventsSender?: ServiceBusSender
}

export function isMessagingEnabled(): boolean {
  return Boolean(process.env.SERVICEBUS_CONNECTION_STRING)
}

export function getBrokerFlavor(): BrokerFlavor {
  return flavorFromConnectionString(process.env.SERVICEBUS_CONNECTION_STRING ?? '')
}

export function getBusClient(): ServiceBusClient {
  const connectionString = process.env.SERVICEBUS_CONNECTION_STRING
  if (!connectionString) throw new Error('SERVICEBUS_CONNECTION_STRING no está configurada')

  if (!globalForBus.svBusClient) {
    globalForBus.svBusClient = new ServiceBusClient(connectionString, {
      // El SDK espera por defecto 30s fijos entre reintentos. Con backoff
      // exponencial desde 1s, las operaciones fallan rápido si el broker no está,
      // y los consumidores reconectan pronto pero se van espaciando (hasta 30s)
      // mientras siga caído, en vez de insistir sin pausa.
      retryOptions: {
        mode: RetryMode.Exponential,
        maxRetries: 2,
        retryDelayInMs: 1_000,
        maxRetryDelayInMs: 30_000,
        timeoutInMs: 5_000,
      },
    })
  }
  return globalForBus.svBusClient
}

/** Sender del topic de eventos, reutilizado entre publicaciones. */
export function getEventsSender(): ServiceBusSender {
  if (!globalForBus.svEventsSender) {
    globalForBus.svEventsSender = getBusClient().createSender(TOPIC_EVENTS)
  }
  return globalForBus.svEventsSender
}

/**
 * Los errores de conexión suelen venir sin mensaje: el dato útil está en `code`,
 * o dentro de un AggregateError (un intento fallido por cada dirección IP).
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const code = (error as { code?: string }).code
  const causes = error instanceof AggregateError ? error.errors.map(describeError) : []
  return [error.name, code, error.message, ...Array.from(new Set(causes))].filter(Boolean).join(' · ')
}
