/**
 * PRODUCTOR — simulador de eventos de negocio de SecureVault.
 *
 * Publica un flujo continuo de eventos realistas en el topic
 * securevault.eventos-negocio (clave = empresa → partición).
 *
 *   npm run kafka:producer                       # ~4 eventos/s, ráfaga sospechosa cada 45 s
 *   npm run kafka:producer -- --rate=10          # más tráfico
 *   npm run kafka:producer -- --burst-every=0    # sin ráfagas
 *   npm run kafka:producer -- --duration=60      # se detiene a los 60 s
 *
 * Ctrl+C para detenerlo.
 */
import { arg, time, LEVEL_COLOR, RESET, DIM, BOLD } from './env'
import { createKafka, createProducer, sendEvents, getTopic } from '@/lib/streaming/kafka'
import { createSimulator } from '@/lib/streaming/simulator'
import { EVENT_LABELS, type BusinessEvent } from '@/lib/streaming/events'

const rate = Math.max(0.2, Number(arg('rate', '4')))
const burstEvery = Math.max(0, Number(arg('burst-every', '45')))
const duration = Math.max(0, Number(arg('duration', '0')))

function line(e: BusinessEvent, note = '') {
  const level = e.confidentialityLevel ? `${LEVEL_COLOR[e.confidentialityLevel]}${e.confidentialityLevel.padEnd(7)}${RESET}` : ' '.repeat(7)
  const doc = e.documentName ? ` · ${e.documentName}` : ''
  console.log(
    `${DIM}${time()}${RESET}  ${EVENT_LABELS[e.type].padEnd(26)} ${level} ${e.companyName} · ${e.userName}${doc}${note}`
  )
}

async function main() {
  const topic = getTopic()
  const producer = createProducer(createKafka('simulador'))
  await producer.connect()
  console.log(`${BOLD}Productor conectado${RESET} → topic ${topic} · ${rate} eventos/s · ráfaga cada ${burstEvery || '—'} s\n`)

  const sim = createSimulator()
  let sent = 0
  let stopping = false
  const startedAt = Date.now()
  let lastBurst = Date.now()

  const stop = async () => {
    if (stopping) return
    stopping = true
    await producer.disconnect()
    console.log(`\n${BOLD}Productor detenido${RESET}: ${sent} eventos publicados en ${Math.round((Date.now() - startedAt) / 1000)} s`)
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  // Cada 250 ms se publica la cantidad que corresponde a la tasa pedida (con algo de variación)
  const tickMs = 250
  let carry = 0
  while (!stopping) {
    const tickStart = Date.now()
    carry += (rate * tickMs) / 1000 * (0.5 + Math.random())
    const count = Math.floor(carry)
    carry -= count

    const batch: BusinessEvent[] = Array.from({ length: count }, () => sim.next())
    let burst: BusinessEvent[] = []
    if (burstEvery > 0 && Date.now() - lastBurst >= burstEvery * 1000) {
      lastBurst = Date.now()
      burst = sim.burst()
    }

    if (batch.length + burst.length > 0) {
      try {
        await sendEvents(producer, [...batch, ...burst], topic)
        sent += batch.length + burst.length
        batch.forEach((e) => line(e))
        if (burst.length) {
          console.log(`${LEVEL_COLOR.CRITICO}${BOLD}  ⚠ Ráfaga sospechosa: ${burst[0].userName} descarga ${burst.length} documentos sensibles${RESET}`)
          burst.forEach((e) => line(e, `${LEVEL_COLOR.CRITICO}  ← ráfaga${RESET}`))
        }
      } catch (err) {
        console.error(`Error publicando: ${err instanceof Error ? err.message : err}`)
      }
    }

    if (duration > 0 && Date.now() - startedAt >= duration * 1000) break
    await new Promise((r) => setTimeout(r, Math.max(0, tickMs - (Date.now() - tickStart))))
  }
  await stop()
}

main().catch((err) => {
  console.error(`No se pudo iniciar el productor: ${err instanceof Error ? err.message : err}`)
  console.error('¿Está Kafka arriba? → npm run kafka:up')
  process.exit(1)
})
