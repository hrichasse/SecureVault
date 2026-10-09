/**
 * @jest-environment node
 *
 * Pruebas de integración de la mensajería contra un broker real (el emulador de
 * Azure Service Bus). Ejercitan el cableado de producción —publisher, consumers,
 * runner, rpc y dead-letter— y solo reemplazan los handlers de negocio por
 * dobles, para poder provocar fallos a voluntad.
 *
 * Requieren el emulador arriba (`npm run mq:up`) y se ejecutan con `npm run test:mq`.
 * Usan entidades con prefijo "test-", así que no interfieren con `npm run dev`.
 */

import type { ServiceBusReceiver } from '@azure/service-bus'
import type { AnyEventEnvelope } from '@/lib/messaging/events'

const indexerHandler = jest.fn<Promise<void>, [AnyEventEnvelope]>()
const notifierHandler = jest.fn<Promise<void>, [AnyEventEnvelope]>()

jest.mock('@/lib/messaging/subscriptions', () => ({
  SUBSCRIPTION_CONSUMERS: {
    indexer: { maxConcurrentCalls: 1, handler: (e: AnyEventEnvelope) => indexerHandler(e) },
    notifier: { maxConcurrentCalls: 4, handler: (e: AnyEventEnvelope) => notifierHandler(e) },
  },
}))

import { getBusClient, getEventsSender } from '@/lib/messaging/bus'
import { publishEvent } from '@/lib/messaging/publisher'
import { getWorkerInfo, startConsumers } from '@/lib/messaging/consumers'
import { requestReply, RpcTimeoutError } from '@/lib/messaging/rpc'
import { getSubscriptionsStatus, listDeadLetters, settleDeadLetter } from '@/lib/messaging/dead-letter'
import { PermanentError } from '@/lib/messaging/settlement'
import { QUEUE_RPC_REQUESTS, TOPIC_EVENTS } from '@/lib/messaging/topology'

const describeWithBroker = process.env.MQ_E2E === '1' ? describe : describe.skip

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(condition: () => boolean | Promise<boolean>, what: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await sleep(100)
  }
  throw new Error(`Tiempo agotado esperando: ${what}`)
}

const receivers = new Map<string, ServiceBusReceiver>()

/**
 * Un receptor por cola, reutilizado en toda la suite: abrir y cerrar un enlace
 * AMQP en cada paso es caro (y el emulador se congela si se hace en ráfaga).
 */
function receiverFor(entity: 'indexer' | 'notifier' | 'rpc', deadLetter = false): ServiceBusReceiver {
  const key = `${entity}:${deadLetter}`
  let receiver = receivers.get(key)
  if (!receiver) {
    const client = getBusClient()
    const options = deadLetter ? ({ subQueueType: 'deadLetter' } as const) : undefined
    receiver =
      entity === 'rpc'
        ? client.createReceiver(QUEUE_RPC_REQUESTS, options)
        : client.createReceiver(TOPIC_EVENTS, entity, options)
    receivers.set(key, receiver)
  }
  return receiver
}

async function drain(receiver: ServiceBusReceiver) {
  for (;;) {
    const batch = await receiver.receiveMessages(50, { maxWaitTimeInMs: 1_000 })
    if (batch.length === 0) break
    await Promise.all(batch.map((m) => receiver.completeMessage(m)))
  }
}

/** Deja las entidades de prueba vacías (colas activas y DLQ). */
async function purge() {
  for (const subscription of ['indexer', 'notifier'] as const) {
    await drain(receiverFor(subscription))
    await drain(receiverFor(subscription, true))
  }
  await drain(receiverFor('rpc'))
}

const statusOf = async (name: string) => (await getSubscriptionsStatus()).find((s) => s.name === name)!

const documentUploaded = (documentId: string) => ({
  documentId,
  companyId: 'company-1',
  name: 'Contrato',
  confidentialityLevel: 'ALTO',
  uploadedById: 'user-1',
})

describeWithBroker('Mensajería sobre Azure Service Bus (emulador)', () => {
  jest.setTimeout(60_000)

  beforeAll(async () => {
    expect(TOPIC_EVENTS).toBe('test-sv-events')
    await purge()
  })

  afterAll(async () => {
    await purge()
    await getBusClient().close()
  })

  beforeEach(() => {
    indexerHandler.mockReset().mockResolvedValue(undefined)
    notifierHandler.mockReset().mockResolvedValue(undefined)
  })

  // ── Antes de que exista ningún consumidor ────────────────────────────────

  describe('sin consumidores activos', () => {
    it('síncrono: una petición sin worker expira por timeout y no deja residuos (retención corta)', async () => {
      await expect(requestReply('ping', undefined, 1_500)).rejects.toBeInstanceOf(RpcTimeoutError)

      // La cola de peticiones no manda los expirados a la DLQ: simplemente se descartan.
      await sleep(1_000)
      expect(await receiverFor('rpc').receiveMessages(5, { maxWaitTimeInMs: 1_500 })).toHaveLength(0)
      expect(await receiverFor('rpc', true).receiveMessages(5, { maxWaitTimeInMs: 1_500 })).toHaveLength(0)
    })

    it('retención: un evento que expira sin consumirse termina en la DLQ con TTLExpiredException', async () => {
      await getEventsSender().sendMessages({
        body: { id: 'evt-ttl', type: 'document.uploaded', occurredAt: new Date().toISOString(), data: documentUploaded('doc-ttl') },
        messageId: 'evt-ttl',
        subject: 'document.uploaded',
        timeToLive: 2_000,
      })
      await sleep(4_000)

      expect(await receiverFor('indexer').receiveMessages(5, { maxWaitTimeInMs: 1_500 })).toHaveLength(0)

      await waitFor(async () => (await listDeadLetters()).some((d) => d.messageId === 'evt-ttl'), 'evento expirado en la DLQ')
      const expired = (await listDeadLetters()).filter((d) => d.messageId === 'evt-ttl')
      expect(expired.map((d) => d.reason)).toEqual(expect.arrayContaining(['TTLExpiredException']))
      // Nadie llegó a procesarlo.
      expect(expired.map((d) => d.attempts)).toEqual(expired.map(() => 0))
      await purge()
    })

    it('asíncrono + durabilidad: el evento publicado queda guardado en el broker hasta que arranca un consumidor', async () => {
      await publishEvent('document.uploaded', documentUploaded('doc-durable'))

      // Nadie lo ha consumido: está persistido, una copia por suscripción.
      await waitFor(
        async () => (await statusOf('indexer')).active === 1 && (await statusOf('notifier')).active === 1,
        'una copia del evento en cada suscripción'
      )
      // Y ahí se queda mientras no haya quién lo consuma.
      await sleep(1_500)
      expect((await statusOf('indexer')).active).toBe(1)
      expect(indexerHandler).not.toHaveBeenCalled()

      // "Arranca la app": los consumidores reciben lo que estaba esperando.
      startConsumers()
      await waitFor(() => indexerHandler.mock.calls.length === 1 && notifierHandler.mock.calls.length === 1, 'entrega tras arrancar')

      expect(indexerHandler.mock.calls[0][0]).toMatchObject({ type: 'document.uploaded', data: { documentId: 'doc-durable' } })
      // Ack: una vez confirmado (complete), el mensaje sale de la cola.
      await waitFor(async () => (await statusOf('indexer')).active === 0 && (await statusOf('notifier')).active === 0, 'colas vacías tras el ack')
    })
  })

  // ── Con los consumidores ya corriendo ────────────────────────────────────

  describe('con consumidores activos', () => {
    it('pub/sub: cada suscripción recibe solo los eventos de su filtro', async () => {
      const acked = getWorkerInfo()!.stats.notifier.processed

      await publishEvent('incident.created', {
        incidentId: 'inc-1', companyId: 'company-1', title: 'Acceso indebido', priority: 'HIGH', createdById: 'user-1',
      })
      // El contador solo sube al confirmar un mensaje recibido del broker: descarta
      // que el evento haya llegado por el fallback en línea de publishEvent.
      await waitFor(() => getWorkerInfo()!.stats.notifier.processed === acked + 1, 'notifier confirma incident.created')
      await sleep(1_000)

      expect(notifierHandler).toHaveBeenCalledTimes(1)
      expect(notifierHandler.mock.calls[0][0].type).toBe('incident.created')
      expect(indexerHandler).not.toHaveBeenCalled()
    })

    it('ack con reintento: un fallo transitorio se reintenta con backoff hasta que el handler confirma', async () => {
      indexerHandler
        .mockRejectedValueOnce(new Error('Gemini 429'))
        .mockRejectedValueOnce(new Error('Gemini 429'))
        .mockResolvedValue(undefined)
      const before = { ...getWorkerInfo()!.stats.indexer }

      await publishEvent('document.uploaded', documentUploaded('doc-retry'))
      await waitFor(() => indexerHandler.mock.calls.length === 3, 'tercer intento')
      await waitFor(async () => (await statusOf('indexer')).active === 0, 'mensaje confirmado')

      const after = getWorkerInfo()!.stats.indexer
      expect(after.retried - before.retried).toBe(2)
      expect(after.processed - before.processed).toBe(1)
      expect((await statusOf('indexer')).deadLettered).toBe(0)
    })

    it('DLQ + alerta: al agotar los reintentos el mensaje va a la DLQ con el último error y se publica una alerta', async () => {
      indexerHandler.mockRejectedValue(new Error('Storage no disponible'))

      await publishEvent('document.uploaded', documentUploaded('doc-agotado'))
      await waitFor(async () => (await statusOf('indexer')).deadLettered === 1, 'mensaje en la DLQ')

      // maxDeliveryCount = 5 entregas, ni una más.
      expect(indexerHandler).toHaveBeenCalledTimes(5)

      const [dead] = (await listDeadLetters()).filter((d) => d.subscription === 'indexer')
      expect(dead.reason).toBe('MaxDeliveryCountExceeded')
      expect(dead.attempts).toBe(5)
      expect(dead.description).toContain('Storage no disponible')
      expect(dead.body).toMatchObject({ data: { documentId: 'doc-agotado' } })

      // La alerta es otro evento que viaja por el mismo topic hasta el notifier.
      await waitFor(
        () => notifierHandler.mock.calls.some(([e]) => e.type === 'messaging.dead-lettered'),
        'alerta de DLQ entregada al notifier'
      )
      const alert = notifierHandler.mock.calls.map(([e]) => e).find((e) => e.type === 'messaging.dead-lettered')!
      expect(alert.data).toMatchObject({ subscription: 'indexer', eventType: 'document.uploaded', reason: 'MaxDeliveryCountExceeded' })
    })

    it('DLQ: reprocesar ejecuta de nuevo el handler; si vuelve a fallar el mensaje se queda, si funciona sale', async () => {
      const [dead] = (await listDeadLetters()).filter((d) => d.subscription === 'indexer')

      indexerHandler.mockRejectedValue(new Error('sigue caído'))
      expect(await settleDeadLetter('indexer', dead.sequenceNumber, 'reprocess')).toEqual({ ok: false, error: 'sigue caído' })
      // Sigue en la DLQ, con un intento más anotado (eran 5).
      expect((await listDeadLetters()).filter((d) => d.subscription === 'indexer').map((d) => d.attempts)).toEqual([6])

      indexerHandler.mockReset().mockResolvedValue(undefined)
      expect(await settleDeadLetter('indexer', dead.sequenceNumber, 'reprocess')).toEqual({ ok: true })
      expect(indexerHandler).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ documentId: 'doc-agotado' }) }))
      expect((await statusOf('indexer')).deadLettered).toBe(0)
    })

    it('error permanente: va directo a la DLQ sin reintentar, y se puede descartar', async () => {
      indexerHandler.mockRejectedValue(new PermanentError('PdfUnparseable', 'El PDF no se pudo leer'))

      await publishEvent('document.uploaded', documentUploaded('doc-corrupto'))
      await waitFor(async () => (await statusOf('indexer')).deadLettered === 1, 'mensaje en la DLQ')

      expect(indexerHandler).toHaveBeenCalledTimes(1)
      const [dead] = (await listDeadLetters()).filter((d) => d.subscription === 'indexer')
      expect(dead.reason).toBe('PdfUnparseable')
      expect(dead.attempts).toBe(1)

      expect(await settleDeadLetter('indexer', dead.sequenceNumber, 'discard')).toEqual({ ok: true })
      expect((await statusOf('indexer')).deadLettered).toBe(0)
    })

    it('mensaje mal formado: va a la DLQ sin llegar al handler', async () => {
      await getEventsSender().sendMessages({ body: 'esto no es un evento', messageId: 'evt-basura', subject: 'document.uploaded' })
      await waitFor(async () => (await statusOf('indexer')).deadLettered === 1, 'mensaje en la DLQ')

      expect(indexerHandler).not.toHaveBeenCalled()
      const [dead] = (await listDeadLetters()).filter((d) => d.subscription === 'indexer')
      expect(dead.reason).toBe('MalformedMessage')
    })

    it('síncrono: request/reply devuelve la respuesta del worker; una acción desconocida vuelve como error', async () => {
      const info = await requestReply<{ pid: number; stats: Record<string, unknown> }>('ping')
      expect(info.pid).toBe(process.pid)
      expect(Object.keys(info.stats)).toEqual(['indexer', 'notifier'])

      await expect(requestReply('accion-inexistente')).rejects.toThrow('Acción desconocida: accion-inexistente')
    })

    it('síncrono: peticiones concurrentes reciben cada una su propia respuesta (sesiones)', async () => {
      const replies = await Promise.all(Array.from({ length: 4 }, () => requestReply<{ pid: number }>('ping')))
      expect(replies.map((r) => r.pid)).toEqual([process.pid, process.pid, process.pid, process.pid])
    })
  })
})
