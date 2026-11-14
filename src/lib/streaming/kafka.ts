/**
 * kafka.ts — Conexión a Apache Kafka.
 *
 * Configuración por variables de entorno:
 *   KAFKA_BROKERS   lista separada por comas (p. ej. "localhost:9092"). Sin ella,
 *                   el streaming queda deshabilitado (la app funciona igual).
 *   KAFKA_TOPIC     topic de eventos de negocio (por defecto securevault.eventos-negocio)
 *   KAFKA_CLIENT_ID identificador del cliente (por defecto "securevault")
 */
import { Kafka, logLevel, Partitioners, type Producer, type logCreator } from 'kafkajs'
import type { BusinessEvent } from './events'

export const DEFAULT_TOPIC = 'securevault.eventos-negocio'

export function getTopic(): string {
  return process.env.KAFKA_TOPIC || DEFAULT_TOPIC
}

export function getBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
}

export function isStreamingEnabled(): boolean {
  return getBrokers().length > 0
}

/**
 * Errores que Kafka devuelve mientras se prepara (p. ej. al crear su topic interno
 * de grupos en el primer arranque). kafkajs los reintenta solo; no vale la pena
 * mostrarlos como errores.
 */
const TRANSIENT = [
  'The group coordinator is not available',
  'The coordinator is loading',
  'There is no leader for this topic-partition',
]

const quietLogCreator: logCreator = () => ({ namespace, level, log }) => {
  if (TRANSIENT.some((t) => log.error?.includes(t) || log.message?.includes(t))) return
  const text = `[kafka ${namespace}] ${log.message}${log.error ? `: ${log.error}` : ''}`
  if (level <= logLevel.ERROR) console.error(text)
  else console.warn(text)
}

/** Cliente Kafka. Un objeto liviano: las conexiones las abren productores y consumidores. */
export function createKafka(clientIdSuffix?: string): Kafka {
  const brokers = getBrokers()
  if (brokers.length === 0) throw new Error('KAFKA_BROKERS no está configurada')
  const base = process.env.KAFKA_CLIENT_ID || 'securevault'
  return new Kafka({
    clientId: clientIdSuffix ? `${base}-${clientIdSuffix}` : base,
    brokers,
    logLevel: logLevel.WARN,
    logCreator: quietLogCreator,
    retry: { retries: 5, initialRetryTime: 300 },
  })
}

/** Productor con el particionador por defecto de Kafka (por clave, igual que el cliente Java). */
export function createProducer(kafka: Kafka): Producer {
  return kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: false,
  })
}

/**
 * Publica eventos de negocio. La clave es el companyId: todos los eventos de una
 * empresa caen en la misma partición y se consumen en orden.
 */
export async function sendEvents(producer: Producer, events: BusinessEvent[], topic = getTopic()) {
  if (events.length === 0) return
  await producer.send({
    topic,
    messages: events.map((event) => ({
      key: event.companyId,
      value: JSON.stringify(event),
      headers: { type: event.type, source: event.source },
      timestamp: String(new Date(event.occurredAt).getTime()),
    })),
  })
}
