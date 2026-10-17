import type { ServiceBusReceivedMessage, ServiceBusReceiver } from '@azure/service-bus'
import { handleMessage, newStats, parseEnvelope, type RunnerContext } from '@/lib/messaging/runner'
import { PermanentError } from '@/lib/messaging/settlement'

const validEvent = {
  id: 'evt-1',
  type: 'document.uploaded',
  occurredAt: '2026-10-03T12:00:00.000Z',
  data: { documentId: 'doc-1', companyId: 'c-1', name: 'Contrato', confidentialityLevel: 'ALTO', uploadedById: 'u-1' },
}

function fakeReceiver() {
  return {
    completeMessage: jest.fn().mockResolvedValue(undefined),
    abandonMessage: jest.fn().mockResolvedValue(undefined),
    deadLetterMessage: jest.fn().mockResolvedValue(undefined),
  }
}

function message(overrides: Partial<ServiceBusReceivedMessage> = {}) {
  return { body: validEvent, messageId: 'evt-1', subject: 'document.uploaded', deliveryCount: 0, ...overrides } as ServiceBusReceivedMessage
}

function context(handler: RunnerContext['handler'], overrides: Partial<RunnerContext> = {}): RunnerContext {
  return { subscription: 'indexer', maxDeliveryCount: 5, handler, stats: newStats(), retryBaseMs: 1, ...overrides }
}

const run = (receiver: ReturnType<typeof fakeReceiver>, msg: ServiceBusReceivedMessage, ctx: RunnerContext) =>
  handleMessage(receiver as unknown as ServiceBusReceiver, msg, ctx)

describe('parseEnvelope', () => {
  it('acepta un evento conocido', () => {
    expect(parseEnvelope(validEvent)).toBe(validEvent)
  })

  it.each([
    ['un texto', 'esto no es un evento'],
    ['null', null],
    ['un tipo desconocido', { ...validEvent, type: 'tipo.inventado' }],
    ['un evento sin id', { ...validEvent, id: undefined }],
    ['un evento sin datos', { ...validEvent, data: null }],
  ])('rechaza %s como error permanente', (_label, body) => {
    expect(() => parseEnvelope(body)).toThrow(PermanentError)
  })
})

describe('handleMessage (ack según el resultado del handler)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('handler OK → complete', async () => {
    const receiver = fakeReceiver()
    const ctx = context(jest.fn().mockResolvedValue(undefined))

    await run(receiver, message({ deliveryCount: 2 }), ctx)

    expect(ctx.handler).toHaveBeenCalledWith(validEvent, { deliveryCount: 2 })
    expect(receiver.completeMessage).toHaveBeenCalledTimes(1)
    expect(receiver.abandonMessage).not.toHaveBeenCalled()
    expect(ctx.stats).toMatchObject({ processed: 1, retried: 0, deadLettered: 0 })
  })

  it('fallo transitorio → abandon, para que el broker lo reentregue', async () => {
    const receiver = fakeReceiver()
    const ctx = context(jest.fn().mockRejectedValue(new Error('Gemini 429')))

    await run(receiver, message({ deliveryCount: 1 }), ctx)

    expect(receiver.abandonMessage).toHaveBeenCalledTimes(1)
    expect(receiver.completeMessage).not.toHaveBeenCalled()
    expect(receiver.deadLetterMessage).not.toHaveBeenCalled()
    expect(ctx.stats).toMatchObject({ processed: 0, retried: 1, lastError: 'Gemini 429' })
  })

  it('último intento → DLQ con el último error, y avisa', async () => {
    const receiver = fakeReceiver()
    const onDeadLetter = jest.fn().mockResolvedValue(undefined)
    const ctx = context(jest.fn().mockRejectedValue(new Error('Storage caído')), { onDeadLetter })

    await run(receiver, message({ deliveryCount: 4 }), ctx)

    expect(receiver.deadLetterMessage).toHaveBeenCalledWith(expect.anything(), {
      deadLetterReason: 'MaxDeliveryCountExceeded',
      deadLetterErrorDescription: 'Agotados 5 intentos. Último error: Storage caído',
      attempts: 5,
    })
    expect(receiver.abandonMessage).not.toHaveBeenCalled()
    expect(onDeadLetter).toHaveBeenCalledWith({
      subscription: 'indexer',
      eventId: 'evt-1',
      eventType: 'document.uploaded',
      reason: 'MaxDeliveryCountExceeded',
      description: 'Agotados 5 intentos. Último error: Storage caído',
    })
    expect(ctx.stats.deadLettered).toBe(1)
  })

  it('error permanente → DLQ en el primer intento, sin reintentar', async () => {
    const receiver = fakeReceiver()
    const ctx = context(jest.fn().mockRejectedValue(new PermanentError('PdfUnparseable', 'PDF ilegible')))

    await run(receiver, message(), ctx)

    expect(receiver.deadLetterMessage).toHaveBeenCalledWith(expect.anything(), {
      deadLetterReason: 'PdfUnparseable',
      deadLetterErrorDescription: 'PDF ilegible',
      attempts: 1,
    })
    expect(receiver.abandonMessage).not.toHaveBeenCalled()
  })

  it('mensaje mal formado → DLQ sin invocar al handler', async () => {
    const receiver = fakeReceiver()
    const handler = jest.fn()

    await run(receiver, message({ body: 'basura' }), context(handler))

    expect(handler).not.toHaveBeenCalled()
    expect(receiver.deadLetterMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ deadLetterReason: 'MalformedMessage' }))
  })

  it('si no se puede confirmar (bloqueo vencido) no lanza: el broker reentregará', async () => {
    const receiver = fakeReceiver()
    receiver.completeMessage.mockRejectedValue(new Error('MessageLockLost'))
    const ctx = context(jest.fn().mockResolvedValue(undefined))

    await expect(run(receiver, message(), ctx)).resolves.toBeUndefined()
    expect(ctx.stats.processed).toBe(0)
  })
})
