/**
 * CONSUMIDOR — métricas en tiempo real del flujo de eventos de negocio.
 *
 * Se suscribe al topic securevault.eventos-negocio (grupo de consumidores
 * "sv-metricas-terminal") y muestra en la terminal, actualizado cada segundo:
 * eventos por segundo, actividad por tipo / nivel / empresa, alertas de
 * seguridad y los últimos eventos, con la partición y el offset de cada uno.
 *
 *   npm run kafka:consumer                     # panel en vivo
 *   npm run kafka:consumer -- --log            # una línea por evento (estilo tail -f)
 *   npm run kafka:consumer -- --from-beginning # relee todo lo que retiene el topic
 *   npm run kafka:consumer -- --group=otro     # otro grupo = otra copia del flujo
 *
 * Varios consumidores con el MISMO grupo se reparten las 3 particiones;
 * con grupos distintos cada uno recibe todos los eventos.
 */
import { arg, time, LEVEL_COLOR, RESET, DIM, BOLD } from './env'
import { createKafka, getTopic } from '@/lib/streaming/kafka'
import { parseBusinessEvent, EVENT_LABELS, type BusinessEvent } from '@/lib/streaming/events'
import { MetricsWindow } from '@/lib/streaming/metrics'

const logMode = arg('log') === 'true'
const fromBeginning = arg('from-beginning') === 'true'
const groupId = arg('group', 'sv-metricas-terminal')!

const SPARK = '▁▂▃▄▅▆▇█'
const RED = LEVEL_COLOR.CRITICO

function sparkline(values: number[]) {
  const max = Math.max(1, ...values)
  return values.map((v) => (v === 0 ? ' ' : SPARK[Math.min(SPARK.length - 1, Math.floor((v / max) * (SPARK.length - 1)))])).join('')
}

function bar(value: number, max: number, width = 24) {
  const n = max === 0 ? 0 : Math.round((value / max) * width)
  return '█'.repeat(n) + DIM + '░'.repeat(width - n) + RESET
}

const metrics = new MetricsWindow({ windowSeconds: 60 })
const offsets = new Map<number, string>() // partición → último offset leído
const placement = new Map<string, string>() // id de evento → "p1@123"
let assigned: number[] = []

function render() {
  const s = metrics.snapshot()
  const out: string[] = []
  out.push(`${BOLD}SecureVault · Streaming de eventos de negocio${RESET}  ${DIM}topic ${getTopic()} · grupo ${groupId} · ${time()}${RESET}`)
  out.push(
    `Particiones asignadas: ${assigned.length ? assigned.join(', ') : '—'}   ` +
      `Offsets: ${Array.from(offsets.entries()).sort(([a], [b]) => a - b).map(([p, o]) => `p${p}=${o}`).join('  ') || '—'}`
  )
  out.push('')
  out.push(
    `${BOLD}${s.eventsPerSecond.toFixed(1)} ev/s${RESET} (prom. 10 s)   ` +
      `${s.windowCount} en los últimos ${s.windowSeconds} s   ${s.totalReceived} recibidos   ` +
      `${DIM}app: ${s.bySource.app} · simulador: ${s.bySource.simulator}${RESET}`
  )
  out.push(`${DIM}60 s →${RESET} ${sparkline(s.series.map((p) => p.count))}`)
  out.push('')

  out.push(`${BOLD}Por tipo de evento${RESET}`)
  const maxType = s.byType[0]?.count ?? 0
  for (const t of s.byType.slice(0, 8)) out.push(`  ${t.label.padEnd(28)} ${bar(t.count, maxType)} ${t.count}`)
  out.push('')

  out.push(`${BOLD}Documentos por nivel de confidencialidad${RESET}`)
  const maxLevel = Math.max(...Object.values(s.byLevel))
  for (const [level, count] of Object.entries(s.byLevel)) {
    out.push(`  ${LEVEL_COLOR[level]}${level.padEnd(8)}${RESET} ${bar(count, maxLevel)} ${count}`)
  }
  out.push('')

  out.push(`${BOLD}Empresas más activas${RESET}`)
  for (const c of s.topCompanies) out.push(`  ${c.companyName.padEnd(32)} ${c.count}`)
  out.push('')

  out.push(`${BOLD}Alertas${RESET}`)
  if (s.alerts.length === 0) out.push(`  ${DIM}sin alertas${RESET}`)
  for (const a of s.alerts.slice(0, 5)) {
    out.push(`  ${RED}⚠ ${a.kind}${RESET} ${DIM}${time(new Date(a.detectedAt))}${RESET} ${a.companyName}: ${a.message}`)
  }
  out.push('')

  out.push(`${BOLD}Últimos eventos${RESET}`)
  for (const e of s.recent.slice(0, 8)) {
    const level = e.confidentialityLevel ? `${LEVEL_COLOR[e.confidentialityLevel]}${e.confidentialityLevel.padEnd(7)}${RESET}` : ' '.repeat(7)
    out.push(
      `  ${DIM}${time(new Date(e.occurredAt))} ${(placement.get(e.id) ?? '').padEnd(9)}${RESET} ${EVENT_LABELS[e.type].padEnd(26)} ${level} ${e.companyName}${e.documentName ? ` · ${e.documentName}` : ''}`
    )
  }
  out.push('')
  out.push(`${DIM}Ctrl+C para salir${RESET}`)

  process.stdout.write('\x1b[2J\x1b[H' + out.join('\n') + '\n')
}

function logLine(e: BusinessEvent, partition: number, offset: string) {
  const level = e.confidentialityLevel ? `${LEVEL_COLOR[e.confidentialityLevel]}${e.confidentialityLevel.padEnd(7)}${RESET}` : ' '.repeat(7)
  console.log(
    `${DIM}${time()} p${partition}@${offset.padEnd(6)}${RESET} ${EVENT_LABELS[e.type].padEnd(26)} ${level} ${e.companyName} · ${e.userName ?? ''}${e.documentName ? ` · ${e.documentName}` : ''}`
  )
}

async function main() {
  const kafka = createKafka('metricas')
  const consumer = kafka.consumer({ groupId })

  consumer.on(consumer.events.GROUP_JOIN, (e) => {
    assigned = (e.payload.memberAssignment[getTopic()] ?? []).slice().sort()
  })

  await consumer.connect()
  await consumer.subscribe({ topic: getTopic(), fromBeginning })

  const stop = async () => {
    await consumer.disconnect().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  if (logMode) console.log(`${BOLD}Consumidor conectado${RESET} → topic ${getTopic()} · grupo ${groupId}\n`)
  else setInterval(render, 1000)

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      offsets.set(partition, message.offset)
      const event = parseBusinessEvent(message.value)
      if (!event) return // mensaje que no es un evento válido: se ignora
      placement.set(event.id, `p${partition}@${message.offset}`)
      if (placement.size > 500) placement.delete(placement.keys().next().value!)

      const alerts = metrics.add(event)
      if (logMode) {
        logLine(event, partition, message.offset)
        for (const a of alerts) console.log(`${RED}${BOLD}  ⚠ ALERTA ${a.kind}${RESET}${RED}: ${a.message}${RESET}`)
      }
    },
  })
}

main().catch((err) => {
  console.error(`No se pudo iniciar el consumidor: ${err instanceof Error ? err.message : err}`)
  console.error('¿Está Kafka arriba? → npm run kafka:up')
  process.exit(1)
})
