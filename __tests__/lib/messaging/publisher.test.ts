/**
 * @jest-environment node
 */
import type { AnyEventEnvelope } from '@/lib/messaging/events'

const sendMessages = jest.fn()
const isMessagingEnabled = jest.fn()
const indexer = jest.fn<Promise<void>, [AnyEventEnvelope]>()
const notifier = jest.fn<Promise<void>, [AnyEventEnvelope]>()

jest.mock('@/lib/messaging/bus', () => ({
  isMessagingEnabled: () => isMessagingEnabled(),
  getBrokerFlavor: () => 'azure',
  getEventsSender: () => ({ sendMessages }),
  describeError: (e: unknown) => String(e),
}))

jest.mock('@/lib/messaging/subscriptions', () => ({
  SUBSCRIPTION_CONSUMERS: {
    indexer: { maxConcurrentCalls: 1, handler: (e: AnyEventEnvelope) => indexer(e) },
    notifier: { maxConcurrentCalls: 4, handler: (e: AnyEventEnvelope) => notifier(e) },
  },
}))

import { publishEvent } from '@/lib/messaging/publisher'

const upload = { documentId: 'doc-1', companyId: 'c-1', name: 'Contrato', confidentialityLevel: 'ALTO', uploadedById: 'u-1' }
const incident = { incidentId: 'i-1', companyId: 'c-1', title: 'Fuga', priority: 'HIGH', createdById: 'u-1' }

describe('publishEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    indexer.mockResolvedValue(undefined)
    notifier.mockResolvedValue(undefined)
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('con broker: envía el evento al topic con su tipo como subject y no lo procesa en línea', async () => {
    isMessagingEnabled.mockReturnValue(true)
    sendMessages.mockResolvedValue(undefined)

    await publishEvent('document.uploaded', upload)

    const [sent, options] = sendMessages.mock.calls[0]
    expect(sent).toMatchObject({ subject: 'document.uploaded', body: { type: 'document.uploaded', data: upload } })
    expect(sent.messageId).toBe(sent.body.id)
    expect(options.abortSignal).toBeInstanceOf(AbortSignal)
    expect(indexer).not.toHaveBeenCalled()
    expect(notifier).not.toHaveBeenCalled()
  })

  it('sin broker configurado: reparte en línea a los suscriptores de ese tipo de evento', async () => {
    isMessagingEnabled.mockReturnValue(false)

    await publishEvent('document.uploaded', upload)

    expect(sendMessages).not.toHaveBeenCalled()
    expect(indexer).toHaveBeenCalledTimes(1)
    expect(notifier).toHaveBeenCalledTimes(1)
  })

  it('en línea respeta los filtros: un incidente no llega al indexador', async () => {
    isMessagingEnabled.mockReturnValue(false)

    await publishEvent('incident.created', incident)

    expect(notifier).toHaveBeenCalledTimes(1)
    expect(indexer).not.toHaveBeenCalled()
  })

  it('broker caído: no lanza y cae al modo en línea', async () => {
    isMessagingEnabled.mockReturnValue(true)
    sendMessages.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(publishEvent('document.uploaded', upload)).resolves.toBeUndefined()

    expect(indexer).toHaveBeenCalledTimes(1)
    expect(notifier).toHaveBeenCalledTimes(1)
  })

  it('un handler que falla en línea no rompe a quien publica', async () => {
    isMessagingEnabled.mockReturnValue(false)
    indexer.mockRejectedValue(new Error('Gemini caído'))

    await expect(publishEvent('document.uploaded', upload)).resolves.toBeUndefined()
    await new Promise((resolve) => setImmediate(resolve))

    expect(notifier).toHaveBeenCalledTimes(1)
  })
})
