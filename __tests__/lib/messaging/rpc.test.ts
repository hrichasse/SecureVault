/**
 * @jest-environment node
 */
import type { ProcessErrorArgs, ServiceBusMessage, ServiceBusReceivedMessage } from '@azure/service-bus'

type SendOptions = { abortSignal?: AbortSignal }

const sendMessages = jest.fn<Promise<void>, [ServiceBusMessage, SendOptions?]>()
const acceptSession = jest.fn()
const closeSession = jest.fn().mockResolvedValue(undefined)

/** Handlers que rpc.ts registra en la sesión de respuestas abierta más reciente. */
let session: {
  processMessage: (reply: Partial<ServiceBusReceivedMessage>) => Promise<void>
  processError: (args: Partial<ProcessErrorArgs>) => Promise<void>
}

jest.mock('@/lib/messaging/bus', () => ({
  describeError: (error: Error) => error.message,
  getBusClient: () => ({ acceptSession, createSender: () => ({ sendMessages }) }),
}))

import { requestReply, RpcTimeoutError } from '@/lib/messaging/rpc'
import { QUEUE_RPC_REPLIES } from '@/lib/messaging/topology'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** El "worker": contesta cada petición en cuanto se envía. */
function workerReplies(reply: (request: ServiceBusMessage) => Partial<ServiceBusReceivedMessage>) {
  sendMessages.mockImplementation(async (request) => {
    void session.processMessage({ correlationId: request.messageId, ...reply(request) })
  })
}

describe('requestReply', () => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)

  beforeAll(() => process.on('unhandledRejection', onUnhandled))
  afterAll(() => process.off('unhandledRejection', onUnhandled))

  beforeEach(() => {
    delete (globalThis as { svRpcClient?: unknown }).svRpcClient
    unhandled.length = 0
    jest.spyOn(console, 'error').mockImplementation(() => {})
    sendMessages.mockReset().mockResolvedValue(undefined)
    closeSession.mockClear()
    acceptSession.mockReset().mockImplementation(async () => ({
      subscribe: (handlers: typeof session) => {
        session = handlers
      },
      close: closeSession,
    }))
  })

  afterEach(() => jest.restoreAllMocks())

  it('envía la petición a nombre de su sesión y devuelve la respuesta que la correlaciona', async () => {
    workerReplies(() => ({ body: { pid: 42 } }))

    await expect(requestReply('ping', { a: 1 }, 500)).resolves.toEqual({ pid: 42 })

    const [queue, sessionId] = acceptSession.mock.calls[0]
    expect(queue).toBe(QUEUE_RPC_REPLIES)
    expect(sendMessages.mock.calls[0][0]).toMatchObject({
      body: { action: 'ping', payload: { a: 1 } },
      replyTo: QUEUE_RPC_REPLIES,
      replyToSessionId: sessionId,
      // Pasado el plazo nadie espera la respuesta: la petición expira en el broker.
      timeToLive: 500,
    })
  })

  it('una respuesta marcada ok=false se convierte en error', async () => {
    workerReplies(() => ({ applicationProperties: { ok: false }, body: { error: 'Acción desconocida: x' } }))

    await expect(requestReply('x', undefined, 500)).rejects.toThrow('Acción desconocida: x')
  })

  it('reutiliza la misma sesión de respuestas para todas las peticiones', async () => {
    workerReplies((request) => ({ body: request.body }))

    const replies = await Promise.all([requestReply('a'), requestReply('b'), requestReply('c')])

    expect(replies.map((r) => (r as { action: string }).action)).toEqual(['a', 'b', 'c'])
    expect(acceptSession).toHaveBeenCalledTimes(1)
  })

  it('sin respuesta, vence con RpcTimeoutError e ignora una respuesta tardía', async () => {
    await expect(requestReply('ping', undefined, 30)).rejects.toBeInstanceOf(RpcTimeoutError)

    const late = sendMessages.mock.calls[0][0].messageId
    await expect(session.processMessage({ correlationId: late, body: {} })).resolves.toBeUndefined()
  })

  it('si el envío falla, propaga ese error y no deja la petición esperando', async () => {
    sendMessages.mockRejectedValue(new Error('broker caído'))

    await expect(requestReply('ping', undefined, 30)).rejects.toThrow('broker caído')

    await sleep(60) // deja pasar el plazo: no debe quedar ningún rechazo suelto
    expect(unhandled).toEqual([])
  })

  it('si el plazo vence con el envío todavía en curso, lo cancela sin rechazos sin manejar', async () => {
    // Como el SDK: el envío queda colgado hasta que la señal de abort lo corta,
    // y tarda un instante en enterarse (el plazo de la respuesta ya venció).
    sendMessages.mockImplementation(
      (_request, options) =>
        new Promise<void>((_resolve, reject) => {
          options?.abortSignal?.addEventListener('abort', () => setTimeout(() => reject(new Error('envío cancelado')), 20))
        })
    )

    await expect(requestReply('ping', undefined, 30)).rejects.toThrow('envío cancelado')

    await sleep(30)
    expect(unhandled).toEqual([])
  })

  it('si se pierde la sesión, falla lo pendiente de inmediato y la siguiente petición abre otra', async () => {
    const pending = requestReply('ping', undefined, 5_000)
    await sleep(10) // la petición ya salió y espera respuesta
    await session.processError({ error: new Error('SessionLockLost') })

    await expect(pending).rejects.toThrow('se perdió la sesión de respuestas (SessionLockLost)')
    expect(closeSession).toHaveBeenCalledTimes(1)

    workerReplies(() => ({ body: 'ok' }))
    await expect(requestReply('ping', undefined, 500)).resolves.toBe('ok')

    expect(acceptSession).toHaveBeenCalledTimes(2)
    expect(acceptSession.mock.calls[1][1]).not.toBe(acceptSession.mock.calls[0][1])
  })

  it('si la sesión no se puede abrir, propaga el error y reintenta en la siguiente petición', async () => {
    acceptSession.mockRejectedValueOnce(new Error('ServiceBusy'))

    await expect(requestReply('ping', undefined, 500)).rejects.toThrow('ServiceBusy')
    expect(sendMessages).not.toHaveBeenCalled()

    workerReplies(() => ({ body: 'ok' }))
    await expect(requestReply('ping', undefined, 500)).resolves.toBe('ok')
    expect(acceptSession).toHaveBeenCalledTimes(2)
  })
})
