/**
 * PRODUCTOR — relay de auditoría (patrón Transactional Outbox).
 *
 * Conecta Kafka con el sistema existente sin tocar el código de la app: cada
 * acción de negocio ya queda registrada en la tabla AuditLog dentro de la misma
 * transacción que la operación. Este proceso lee las filas nuevas de AuditLog y
 * las publica como eventos en el topic. Solo viajan acciones confirmadas.
 *
 *   npm run kafka:relay                  # desde ahora en adelante
 *   npm run kafka:relay -- --since=60    # incluye los últimos 60 minutos
 *
 * Lee la base de DATABASE_URL (.env). Solo lectura: no modifica nada.
 */
import { arg, time, LEVEL_COLOR, RESET, DIM, BOLD } from './env'
import { prisma } from '@/lib/prisma'
import { createKafka, createProducer, sendEvents, getTopic } from '@/lib/streaming/kafka'
import { createBusinessEvent, EVENT_LABELS, BUSINESS_EVENT_TYPES, type BusinessEvent } from '@/lib/streaming/events'

const POLL_MS = 2000
const BATCH = 200
const sinceMinutes = Math.max(0, Number(arg('since', '0')))

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

async function main() {
  const topic = getTopic()
  const producer = createProducer(createKafka('audit-relay'))
  await producer.connect()

  // Cursor: (createdAt, id) de la última fila publicada
  let cursorAt = new Date(Date.now() - sinceMinutes * 60_000)
  let cursorId = ''
  let relayed = 0
  let stopping = false

  console.log(
    `${BOLD}Relay de auditoría conectado${RESET} → topic ${topic} · leyendo AuditLog desde ${cursorAt.toLocaleString('es-CL')} cada ${POLL_MS / 1000} s\n`
  )

  const stop = async () => {
    if (stopping) return
    stopping = true
    await producer.disconnect()
    await prisma.$disconnect()
    console.log(`\n${BOLD}Relay detenido${RESET}: ${relayed} eventos publicados`)
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  while (!stopping) {
    try {
      const rows = await prisma.auditLog.findMany({
        where: {
          OR: [{ createdAt: { gt: cursorAt } }, { createdAt: cursorAt, id: { gt: cursorId } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: BATCH,
        include: {
          user: { select: { name: true } },
          company: { select: { name: true } },
          document: { select: { name: true, confidentialityLevel: true } },
        },
      })

      const events: BusinessEvent[] = []
      for (const row of rows) {
        if (!(BUSINESS_EVENT_TYPES as readonly string[]).includes(row.action)) continue
        const meta = (row.metadata ?? {}) as Record<string, unknown>
        const priority = PRIORITIES.find((p) => p === meta.priority) ?? null
        events.push(
          createBusinessEvent({
            id: row.id, // el id de AuditLog: si se reenvía, los consumidores pueden deduplicar
            type: row.action as BusinessEvent['type'],
            occurredAt: row.createdAt.toISOString(),
            source: 'app',
            companyId: row.companyId ?? 'sin-empresa',
            companyName: row.company?.name ?? 'Sin empresa',
            userId: row.userId,
            userName: row.user?.name ?? 'Sistema',
            documentId: row.documentId,
            documentName: row.document?.name,
            confidentialityLevel: row.document?.confidentialityLevel ?? null,
            priority,
          })
        )
      }

      if (events.length > 0) {
        await sendEvents(producer, events, topic)
        relayed += events.length
        for (const e of events) {
          const level = e.confidentialityLevel ? `${LEVEL_COLOR[e.confidentialityLevel]}${e.confidentialityLevel}${RESET} ` : ''
          console.log(`${DIM}${time()}${RESET}  ${EVENT_LABELS[e.type].padEnd(26)} ${level}${e.companyName} · ${e.userName}${e.documentName ? ` · ${e.documentName}` : ''}`)
        }
      }
      if (rows.length > 0) {
        const last = rows[rows.length - 1]
        cursorAt = last.createdAt
        cursorId = last.id
      }
      // Lote lleno: hay más filas pendientes, se sigue sin esperar
      if (rows.length === BATCH) continue
    } catch (err) {
      console.error(`Error en el relay (se reintenta): ${err instanceof Error ? err.message : err}`)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main().catch((err) => {
  console.error(`No se pudo iniciar el relay: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
