/**
 * live-feed.ts — Consumidor de Kafka dentro del servidor de la app, para el panel
 * /admin/streaming.
 *
 * Un solo consumidor por proceso (vive en globalThis, igual que Prisma, para
 * sobrevivir al HMR de desarrollo). Arranca la primera vez que alguien abre el
 * panel y se detiene solo tras 5 minutos sin que nadie lo mire.
 *
 * Usa un grupo de consumidores propio de esta instancia (sv-panel-web-xxxx) y
 * empieza desde el final del topic: el panel muestra lo que llega desde que se abre.
 */
import { randomUUID } from 'crypto'
import type { Consumer } from 'kafkajs'
import { createKafka, getTopic } from './kafka'
import { parseBusinessEvent } from './events'
import { MetricsWindow, type MetricsSnapshot } from './metrics'

const IDLE_STOP_MS = 5 * 60_000

export type FeedStatus = 'connecting' | 'connected' | 'error'

export interface FeedSnapshot {
  enabled: true
  status: FeedStatus
  error?: string
  topic: string
  groupId: string
  /** Último offset leído por partición */
  offsets: Record<string, string>
  metrics: MetricsSnapshot
}

interface LiveFeed {
  status: FeedStatus
  error?: string
  groupId: string
  consumer?: Consumer
  metrics: MetricsWindow
  offsets: Record<string, string>
  lastAccess: number
  idleTimer?: NodeJS.Timeout
}

const globalForFeed = globalThis as unknown as { svLiveFeed?: LiveFeed }

async function start(feed: LiveFeed) {
  const consumer = createKafka('panel').consumer({ groupId: feed.groupId })
  feed.consumer = consumer
  await consumer.connect()
  await consumer.subscribe({ topic: getTopic(), fromBeginning: false })
  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      feed.offsets[String(partition)] = message.offset
      const event = parseBusinessEvent(message.value)
      if (event) feed.metrics.add(event)
    },
  })
  feed.status = 'connected'
}

async function stop(feed: LiveFeed) {
  if (feed.idleTimer) clearInterval(feed.idleTimer)
  if (globalForFeed.svLiveFeed === feed) globalForFeed.svLiveFeed = undefined
  await feed.consumer?.disconnect().catch(() => {})
}

function getLiveFeed(): LiveFeed {
  const existing = globalForFeed.svLiveFeed
  if (existing) {
    existing.lastAccess = Date.now()
    return existing
  }

  const feed: LiveFeed = {
    status: 'connecting',
    groupId: `sv-panel-web-${randomUUID().slice(0, 8)}`,
    metrics: new MetricsWindow({ windowSeconds: 60, maxRecent: 20 }),
    offsets: {},
    lastAccess: Date.now(),
  }
  globalForFeed.svLiveFeed = feed

  start(feed).catch((err) => {
    feed.status = 'error'
    feed.error = err instanceof Error ? err.message : String(err)
    console.error('[Streaming] No se pudo conectar el consumidor del panel:', feed.error)
    // Se descarta para reintentar en la próxima apertura del panel
    setTimeout(() => void stop(feed), 5_000)
  })

  feed.idleTimer = setInterval(() => {
    if (Date.now() - feed.lastAccess > IDLE_STOP_MS) void stop(feed)
  }, 60_000)
  feed.idleTimer.unref?.()

  return feed
}

/** Foto del flujo para el panel (arranca el consumidor si hace falta). */
export function getFeedSnapshot(): FeedSnapshot {
  const feed = getLiveFeed()
  return {
    enabled: true,
    status: feed.status,
    error: feed.error,
    topic: getTopic(),
    groupId: feed.groupId,
    offsets: { ...feed.offsets },
    metrics: feed.metrics.snapshot(),
  }
}
