import { buildTopology, EVENT_TYPES, flavorFromConnectionString, subjectFilter } from '@/lib/messaging/topology'

describe('topología de mensajería', () => {
  it('el emulador limita la retención a 1 hora; en Azure son 7 días', () => {
    const ttl = (flavor: 'emulator' | 'azure') => buildTopology(flavor).topic.subscriptions.map((s) => s.defaultMessageTimeToLive)

    expect(ttl('emulator')).toEqual(['PT1H', 'PT1H'])
    expect(ttl('azure')).toEqual(['P7D', 'P7D'])
  })

  it('el prefijo aísla todas las entidades de un entorno', () => {
    const test = buildTopology('emulator', 'test-')
    const app = buildTopology('emulator', '')

    expect([test.topic.name, ...test.queues.map((q) => q.name)]).toEqual(['test-sv-events', 'test-sv-rpc-requests', 'test-sv-rpc-replies'])
    expect([app.topic.name, ...app.queues.map((q) => q.name)]).toEqual(['sv-events', 'sv-rpc-requests', 'sv-rpc-replies'])
  })

  it('cada suscripción filtra solo tipos de evento que existen', () => {
    for (const subscription of buildTopology('azure').topic.subscriptions) {
      for (const subject of subscription.subjects) expect(EVENT_TYPES).toContain(subject)
    }
  })

  it('todo tipo de evento tiene al menos un suscriptor (ningún evento se publica al vacío)', () => {
    const subscribed = new Set(buildTopology('azure').topic.subscriptions.flatMap((s) => s.subjects))

    expect(Array.from(subscribed).sort()).toEqual([...EVENT_TYPES].sort())
  })

  it('el evento de demostración llega a las dos suscripciones (pub/sub)', () => {
    const receivers = buildTopology('azure').topic.subscriptions.filter((s) => s.subjects.includes('demo.requested'))

    expect(receivers.map((s) => s.name)).toEqual(['indexer', 'notifier'])
  })

  it('los eventos van a la DLQ al expirar; las peticiones síncronas simplemente se descartan', () => {
    const topology = buildTopology('azure')

    expect(topology.topic.subscriptions.every((s) => s.deadLetteringOnMessageExpiration)).toBe(true)
    expect(topology.queues.every((q) => !q.deadLetteringOnMessageExpiration)).toBe(true)
  })

  it('solo la cola de respuestas usa sesiones', () => {
    expect(buildTopology('azure', '').queues.map((q) => [q.name, q.requiresSession])).toEqual([
      ['sv-rpc-requests', false],
      ['sv-rpc-replies', true],
    ])
  })

  it('genera el filtro SQL por subject', () => {
    expect(subjectFilter(['document.uploaded', 'incident.created'])).toBe("sys.Label IN ('document.uploaded', 'incident.created')")
  })

  it('reconoce el emulador por su connection string', () => {
    expect(flavorFromConnectionString('Endpoint=sb://localhost;SharedAccessKey=x;UseDevelopmentEmulator=true;')).toBe('emulator')
    expect(flavorFromConnectionString('Endpoint=sb://securevault.servicebus.windows.net/;SharedAccessKey=x')).toBe('azure')
  })
})
