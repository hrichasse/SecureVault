/**
 * @jest-environment node
 */
import { createBusinessEvent, parseBusinessEvent, type BusinessEvent } from '@/lib/streaming/events'
import { MetricsWindow } from '@/lib/streaming/metrics'
import { createSimulator, DEMO_COMPANIES } from '@/lib/streaming/simulator'
import { getBrokers, isStreamingEnabled, getTopic, DEFAULT_TOPIC } from '@/lib/streaming/kafka'

/** Random determinista (LCG) para que el simulador sea reproducible en los tests */
function seeded(seed = 42) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
}

const view = (userId: string, level: 'BAJO' | 'ALTO' | 'CRITICO', i = 0): BusinessEvent =>
  createBusinessEvent({
    type: 'VIEW_DOCUMENT',
    source: 'simulator',
    companyId: 'c1',
    companyName: 'Empresa 1',
    userId,
    userName: `Usuario ${userId}`,
    documentId: `d${i}`,
    documentName: `Doc ${i}`,
    confidentialityLevel: level,
  })

describe('eventos de negocio', () => {
  it('ida y vuelta por el formato del mensaje de Kafka', () => {
    const e = view('u1', 'ALTO')
    expect(parseBusinessEvent(Buffer.from(JSON.stringify(e)))).toEqual(e)
  })

  it('un mensaje mal formado no rompe al consumidor: se ignora', () => {
    expect(parseBusinessEvent('no es json')).toBeNull()
    expect(parseBusinessEvent(JSON.stringify({ type: 'OTRA_COSA' }))).toBeNull()
    expect(parseBusinessEvent(null)).toBeNull()
  })
})

describe('simulador', () => {
  it('genera eventos válidos con empresas, usuarios y documentos coherentes', () => {
    const sim = createSimulator(seeded())
    for (let i = 0; i < 200; i++) {
      const e = sim.next()
      expect(parseBusinessEvent(JSON.stringify(e))).not.toBeNull()
      const company = DEMO_COMPANIES.find((c) => c.id === e.companyId)!
      expect(company).toBeDefined()
      expect(company.users.some((u) => u.id === e.userId)).toBe(true)
      if (e.documentId) expect(company.documents.some((d) => d.id === e.documentId && d.level === e.confidentialityLevel)).toBe(true)
      if (e.type === 'LOGIN' || e.type === 'LOGOUT') expect(e.documentId).toBeNull()
    }
  })

  it('ver documentos es lo más frecuente (pesos realistas)', () => {
    const sim = createSimulator(seeded(7))
    const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) {
      const t = sim.next().type
      counts[t] = (counts[t] ?? 0) + 1
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    expect(top).toBe('VIEW_DOCUMENT')
  })

  it('la ráfaga sospechosa son descargas de documentos ALTO/CRÍTICO de un mismo usuario', () => {
    const burst = createSimulator(seeded(3)).burst(8)
    expect(burst).toHaveLength(8)
    expect(new Set(burst.map((e) => e.userId)).size).toBe(1)
    expect(burst.every((e) => e.type === 'VIEW_DOCUMENT' && ['ALTO', 'CRITICO'].includes(e.confidentialityLevel!))).toBe(true)
  })
})

describe('métricas en tiempo real', () => {
  const t0 = 1_800_000_000_000

  it('cuenta por tipo, nivel, empresa y origen dentro de la ventana', () => {
    const m = new MetricsWindow({ windowSeconds: 60 })
    m.add(view('u1', 'ALTO', 1), t0)
    m.add(view('u2', 'BAJO', 2), t0 + 500)
    m.add(createBusinessEvent({ type: 'LOGIN', source: 'app', companyId: 'c2', companyName: 'Empresa 2' }), t0 + 1000)
    const s = m.snapshot(t0 + 1500)
    expect(s.windowCount).toBe(3)
    expect(s.byType[0]).toMatchObject({ type: 'VIEW_DOCUMENT', count: 2 })
    expect(s.byLevel).toEqual({ BAJO: 1, MEDIO: 0, ALTO: 1, CRITICO: 0 })
    expect(s.topCompanies[0]).toMatchObject({ companyId: 'c1', count: 2 })
    expect(s.bySource).toEqual({ app: 1, simulator: 2 })
    expect(s.series).toHaveLength(60)
    expect(s.series.reduce((a, p) => a + p.count, 0)).toBe(3)
  })

  it('los eventos salen de la ventana al pasar 60 s (el total histórico se mantiene)', () => {
    const m = new MetricsWindow({ windowSeconds: 60 })
    m.add(view('u1', 'BAJO'), t0)
    m.add(view('u1', 'BAJO'), t0 + 30_000)
    const s = m.snapshot(t0 + 61_000)
    expect(s.windowCount).toBe(1)
    expect(s.totalReceived).toBe(2)
  })

  it('eventos por segundo = promedio de los últimos 10 s', () => {
    const m = new MetricsWindow()
    for (let i = 0; i < 20; i++) m.add(view('u1', 'BAJO'), t0 + i * 500) // 2 por segundo durante 10 s
    expect(m.snapshot(t0 + 9_999).eventsPerSecond).toBe(2)
  })

  it('alerta de EXFILTRACION al 5º documento sensible de un mismo usuario, una sola vez por ventana', () => {
    const m = new MetricsWindow({ exfiltrationThreshold: 5 })
    const raised = Array.from({ length: 8 }, (_, i) => m.add(view('u1', i % 2 ? 'ALTO' : 'CRITICO', i), t0 + i * 200))
    expect(raised.slice(0, 4).every((a) => a.length === 0)).toBe(true)
    expect(raised[4]).toHaveLength(1)
    expect(raised[4][0].kind).toBe('EXFILTRACION')
    expect(raised.slice(5).every((a) => a.length === 0)).toBe(true)
    expect(m.snapshot(t0 + 2000).alerts).toHaveLength(1)
  })

  it('con la configuración por defecto, la ráfaga del simulador dispara exactamente una alerta', () => {
    const m = new MetricsWindow()
    const burst = createSimulator(seeded(5)).burst(8)
    const raised = burst.flatMap((e, i) => m.add(e, t0 + i * 250))
    expect(raised.map((a) => a.kind)).toEqual(['EXFILTRACION'])
  })

  it('30 minutos de tráfico normal del simulador (4 ev/s) no dan falsas alarmas de fuga', () => {
    const m = new MetricsWindow()
    const sim = createSimulator(seeded(11))
    let falsas = 0
    for (let i = 0; i < 4 * 60 * 30; i++) {
      falsas += m.add(sim.next(), t0 + i * 250).filter((a) => a.kind === 'EXFILTRACION').length
    }
    expect(falsas).toBe(0)
  })

  it('el uso normal (5 documentos sensibles repartidos en 30 s) no es una fuga', () => {
    const m = new MetricsWindow({ exfiltrationThreshold: 5, exfiltrationWindowSeconds: 10 })
    for (let i = 0; i < 5; i++) m.add(view('u1', 'CRITICO', i), t0 + i * 6_000)
    expect(m.snapshot(t0 + 30_000).alerts).toHaveLength(0)
  })

  it('la serie trae la marca de tiempo de cada segundo (el navegador la muestra en hora local)', () => {
    const m = new MetricsWindow({ windowSeconds: 60 })
    const s = m.snapshot(t0)
    expect(s.series[59].t).toBe(Math.floor(t0 / 1000) * 1000)
    expect(s.series[0].t).toBe(s.series[59].t - 59_000)
  })

  it('las vistas de documentos BAJO o de distintos usuarios no disparan la alerta', () => {
    const m = new MetricsWindow({ exfiltrationThreshold: 3 })
    for (let i = 0; i < 6; i++) m.add(view('u1', 'BAJO', i), t0 + i)
    for (let i = 0; i < 6; i++) m.add(view(`u${i + 10}`, 'CRITICO', i), t0 + 100 + i)
    expect(m.snapshot(t0 + 1000).alerts).toHaveLength(0)
  })

  it('alerta de INCIDENTE_CRITICO', () => {
    const m = new MetricsWindow()
    const alerts = m.add(
      createBusinessEvent({
        type: 'CREATE_INCIDENT',
        source: 'app',
        companyId: 'c1',
        companyName: 'Empresa 1',
        documentName: 'Balance',
        priority: 'CRITICAL',
      }),
      t0
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ kind: 'INCIDENTE_CRITICO', companyName: 'Empresa 1' })
  })
})

describe('configuración', () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env = { ...original }
  })

  it('sin KAFKA_BROKERS el streaming queda deshabilitado', () => {
    delete process.env.KAFKA_BROKERS
    expect(isStreamingEnabled()).toBe(false)
  })

  it('lee varios brokers y el topic por defecto', () => {
    process.env.KAFKA_BROKERS = 'localhost:9092, otro:9092 ,'
    delete process.env.KAFKA_TOPIC
    expect(getBrokers()).toEqual(['localhost:9092', 'otro:9092'])
    expect(getTopic()).toBe(DEFAULT_TOPIC)
  })
})
