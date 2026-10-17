import { simulateDemoProcessing, type DemoScenario } from '@/lib/messaging/demo'
import { PermanentError } from '@/lib/messaging/settlement'
import type { EventEnvelope } from '@/lib/messaging/events'

const demo = (scenario: DemoScenario): EventEnvelope<'demo.requested'> => ({
  id: 'evt-demo',
  type: 'demo.requested',
  occurredAt: '2026-10-17T12:00:00.000Z',
  data: { requestedById: 'u-1', scenario },
})

/** Resultado del indexador en cada entrega: 'ok', o el tipo de error. */
const deliveries = (scenario: DemoScenario, count: number) =>
  Array.from({ length: count }, (_, deliveryCount) => {
    try {
      simulateDemoProcessing(demo(scenario), { deliveryCount })
      return 'ok'
    } catch (error) {
      return error instanceof PermanentError ? 'permanente' : 'transitorio'
    }
  })

describe('modo demostración: lo que hace el indexador', () => {
  it.each<DemoScenario>(['publish', 'ttl'])('"%s" se procesa a la primera', (scenario) => {
    expect(deliveries(scenario, 1)).toEqual(['ok'])
  })

  it('"transient" falla dos entregas y la tercera funciona', () => {
    expect(deliveries('transient', 3)).toEqual(['transitorio', 'transitorio', 'ok'])
  })

  it('"permanent" falla con un error permanente (va a la DLQ sin reintentos)', () => {
    expect(deliveries('permanent', 1)).toEqual(['permanente'])
  })

  it('"exhaust" falla siempre con un error transitorio (agota los reintentos)', () => {
    expect(deliveries('exhaust', 5)).toEqual(Array(5).fill('transitorio'))
  })

  it.each<DemoScenario>(['transient', 'permanent', 'exhaust'])('al reprocesar "%s" desde el panel, funciona', (scenario) => {
    expect(() => simulateDemoProcessing(demo(scenario), { deliveryCount: 5, reprocess: true })).not.toThrow()
  })
})
