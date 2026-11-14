/**
 * topology.ts — Topología de mensajería de SecureVault (Azure Service Bus).
 *
 * Fuente única de verdad de las entidades del broker: de aquí salen el
 * Config.json del emulador local y el aprovisionamiento del namespace en Azure.
 *
 * Sin imports de la app a propósito: los scripts de infraestructura lo cargan
 * sin levantar Next ni Prisma.
 */

export type BrokerFlavor = 'emulator' | 'azure'

/**
 * Prefijo de entidades. Aísla consumidores que comparten un mismo broker: dos
 * entornos sobre un namespace, o los tests de integración ("test-") frente al
 * servidor de desarrollo.
 */
const DEFAULT_PREFIX = process.env.SERVICEBUS_ENTITY_PREFIX ?? ''

export function entityNames(prefix: string = DEFAULT_PREFIX) {
  return {
    topic: `${prefix}sv-events`,
    rpcRequests: `${prefix}sv-rpc-requests`,
    rpcReplies: `${prefix}sv-rpc-replies`,
  }
}

export const TOPIC_EVENTS = entityNames().topic
export const QUEUE_RPC_REQUESTS = entityNames().rpcRequests
export const QUEUE_RPC_REPLIES = entityNames().rpcReplies
export const SUB_INDEXER = 'indexer'
export const SUB_NOTIFIER = 'notifier'

/** Tipos de evento de dominio. Viajan como `subject` del mensaje y los filtros enrutan por él. */
export const EVENT_TYPES = [
  'document.uploaded',
  'incident.created',
  'access-request.created',
  'access-request.reviewed',
  'messaging.dead-lettered',
  // Modo demostración del panel (demo.ts): recorre el bus sin tocar datos reales.
  'demo.requested',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export interface SubscriptionSpec {
  name: string
  /** Tipos de evento que recibe; se traduce a un filtro SQL sobre `sys.Label`. */
  subjects: EventType[]
  /** Tiempo que el consumidor retiene el mensaje antes de que vuelva a estar disponible. */
  lockDuration: string
  /** Entregas fallidas antes de mandar el mensaje a la DLQ. */
  maxDeliveryCount: number
  defaultMessageTimeToLive: string
  /** true: un mensaje que expira va a la DLQ en vez de descartarse en silencio. */
  deadLetteringOnMessageExpiration: boolean
}

export interface QueueSpec {
  name: string
  lockDuration: string
  maxDeliveryCount: number
  defaultMessageTimeToLive: string
  deadLetteringOnMessageExpiration: boolean
  requiresSession: boolean
}

export interface Topology {
  topic: { name: string; defaultMessageTimeToLive: string; subscriptions: SubscriptionSpec[] }
  queues: QueueSpec[]
}

/**
 * Las duraciones son ISO 8601. El emulador limita el TTL a 1 hora, así que la
 * retención "larga" solo aplica en Azure.
 */
export function buildTopology(flavor: BrokerFlavor, prefix: string = DEFAULT_PREFIX): Topology {
  const retention = flavor === 'emulator' ? 'PT1H' : 'P7D'
  const names = entityNames(prefix)

  return {
    topic: {
      name: names.topic,
      defaultMessageTimeToLive: retention,
      subscriptions: [
        {
          name: SUB_INDEXER,
          subjects: ['document.uploaded', 'demo.requested'],
          lockDuration: 'PT1M',
          maxDeliveryCount: 5,
          defaultMessageTimeToLive: retention,
          deadLetteringOnMessageExpiration: true,
        },
        {
          name: SUB_NOTIFIER,
          subjects: [
            'document.uploaded',
            'incident.created',
            'access-request.created',
            'access-request.reviewed',
            'messaging.dead-lettered',
            'demo.requested',
          ],
          lockDuration: 'PT30S',
          maxDeliveryCount: 5,
          defaultMessageTimeToLive: retention,
          deadLetteringOnMessageExpiration: true,
        },
      ],
    },
    queues: [
      {
        // Peticiones síncronas (request/reply): una petición que nadie tomó en
        // 30s ya no sirve, así que expira y se descarta sin pasar por la DLQ.
        name: names.rpcRequests,
        lockDuration: 'PT30S',
        maxDeliveryCount: 3,
        defaultMessageTimeToLive: 'PT30S',
        deadLetteringOnMessageExpiration: false,
        requiresSession: false,
      },
      {
        // Respuestas: con sesiones, cada solicitante lee solo su propia respuesta.
        name: names.rpcReplies,
        lockDuration: 'PT30S',
        maxDeliveryCount: 3,
        defaultMessageTimeToLive: 'PT1M',
        deadLetteringOnMessageExpiration: false,
        requiresSession: true,
      },
    ],
  }
}

/** Nombre de la regla que lleva el filtro de cada suscripción. */
export const SUBJECT_RULE = 'by-subject'

/** Filtro SQL de una suscripción: solo los subjects que le interesan. */
export function subjectFilter(subjects: EventType[]): string {
  return `sys.Label IN (${subjects.map((s) => `'${s}'`).join(', ')})`
}

export function getSubscriptionSpec(name: string, flavor: BrokerFlavor): SubscriptionSpec {
  const spec = buildTopology(flavor).topic.subscriptions.find((s) => s.name === name)
  if (!spec) throw new Error(`Suscripción desconocida: ${name}`)
  return spec
}

/** El emulador se reconoce por su connection string. */
export function flavorFromConnectionString(connectionString: string): BrokerFlavor {
  return /UseDevelopmentEmulator=true/i.test(connectionString) ? 'emulator' : 'azure'
}
