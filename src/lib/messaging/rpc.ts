/**
 * rpc.ts — Mensajería síncrona: request/reply sobre colas.
 *
 * El solicitante envía una petición y espera la respuesta con un timeout:
 *
 *   solicitante ──► cola de peticiones ──► worker
 *   solicitante ◄── cola de respuestas ◄── worker
 *
 * La cola de respuestas usa sesiones. Cada instancia de la app abre UNA sesión
 * propia y la mantiene abierta; sus peticiones llevan ese `replyToSessionId`, así
 * que nunca recibe respuestas dirigidas a otra instancia. Dentro de la sesión,
 * `correlationId` enlaza cada respuesta con la petición que la originó.
 *
 * Los enlaces (sender de peticiones y sesión de respuestas) se crean una vez y
 * se reutilizan: abrir un enlace AMQP por petición es caro y los brokers lo
 * penalizan.
 */

import { randomUUID } from 'crypto'
import type { ServiceBusSender } from '@azure/service-bus'
import { describeError, getBusClient } from './bus'
import { QUEUE_RPC_REPLIES, QUEUE_RPC_REQUESTS } from './topology'

export type RpcHandlers = Record<string, (payload: unknown) => unknown | Promise<unknown>>

export class RpcTimeoutError extends Error {
  constructor(action: string, timeoutMs: number) {
    super(`Sin respuesta a "${action}" en ${timeoutMs}ms: no hay un worker consumiendo la cola de peticiones`)
    this.name = 'RpcTimeoutError'
  }
}

interface PendingRequest {
  resolve: (body: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

interface RpcClientState {
  /** Sesión de respuestas de esta instancia. Cambia si hay que reabrirla. */
  sessionId: string
  /** Se resuelve cuando la sesión de respuestas está abierta y escuchando. */
  listening?: Promise<void>
  requests?: ServiceBusSender
  pending: Map<string, PendingRequest>
}

const globalForRpc = globalThis as unknown as { svRpcClient?: RpcClientState }

/** El SDK renueva el bloqueo de la sesión durante este tiempo; luego se reabre sola. */
const SESSION_LOCK_RENEWAL_MS = 12 * 60 * 60 * 1000

function ensureListening(state: RpcClientState): Promise<void> {
  if (state.listening) return state.listening

  const listening: Promise<void> = (async () => {
    const sessionId = randomUUID()
    const replies = await getBusClient().acceptSession(QUEUE_RPC_REPLIES, sessionId, {
      maxAutoLockRenewalDurationInMs: SESSION_LOCK_RENEWAL_MS,
    })
    state.sessionId = sessionId

    let lost = false
    replies.subscribe({
      processMessage: async (reply) => {
        const request = state.pending.get(String(reply.correlationId))
        // Respuesta de una petición que ya expiró: se descarta.
        if (!request) return
        state.pending.delete(String(reply.correlationId))
        clearTimeout(request.timer)

        if (reply.applicationProperties?.ok === false) {
          const message = (reply.body as { error?: string } | null)?.error
          request.reject(new Error(message ?? 'El worker respondió con error'))
        } else {
          request.resolve(reply.body)
        }
      },
      processError: async (args) => {
        // Una sesión no se recupera tras perderse (corte de conexión, bloqueo
        // vencido): se descarta y la próxima petición abre una nueva.
        if (lost) return
        lost = true
        const reason = `se perdió la sesión de respuestas (${describeError(args.error)})`
        console.error(`[Messaging] rpc: ${reason}`)
        if (state.listening === listening) state.listening = undefined

        // Las respuestas pendientes iban dirigidas a esta sesión: ya no llegarán.
        for (const request of Array.from(state.pending.values())) {
          clearTimeout(request.timer)
          request.reject(new Error(`No se recibió respuesta: ${reason}`))
        }
        state.pending.clear()
        replies.close().catch(() => {})
      },
    })
  })()

  // Si la sesión no llegó a abrirse, la siguiente petición lo intenta de nuevo.
  listening.catch(() => {
    if (state.listening === listening) state.listening = undefined
  })
  state.listening = listening
  return listening
}

/** Envía una petición y espera su respuesta. */
export async function requestReply<T>(action: string, payload?: unknown, timeoutMs = 10_000): Promise<T> {
  if (!globalForRpc.svRpcClient) globalForRpc.svRpcClient = { sessionId: '', pending: new Map() }
  const state = globalForRpc.svRpcClient

  // Primero se escucha, después se pregunta.
  await ensureListening(state)
  state.requests ??= getBusClient().createSender(QUEUE_RPC_REQUESTS)

  const requestId = randomUUID()
  const reply = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(requestId)
      reject(new RpcTimeoutError(action, timeoutMs))
    }, timeoutMs)
    state.pending.set(requestId, { resolve, reject, timer })
  })
  // El plazo puede vencer con el envío todavía en curso, antes de que nadie
  // espere `reply`: sin esto sería un rechazo sin manejar.
  reply.catch(() => {})

  try {
    await state.requests.sendMessages(
      {
        body: { action, payload },
        messageId: requestId,
        subject: action,
        replyTo: QUEUE_RPC_REPLIES,
        replyToSessionId: state.sessionId,
        // Pasado el timeout nadie espera la respuesta: la petición debe expirar.
        timeToLive: timeoutMs,
      },
      { abortSignal: AbortSignal.timeout(timeoutMs) }
    )
  } catch (error) {
    const request = state.pending.get(requestId)
    if (request) clearTimeout(request.timer)
    state.pending.delete(requestId)
    throw error
  }

  return reply as Promise<T>
}

/** Lado worker: atiende peticiones y responde a la sesión que indica cada una. */
export function startRpcResponder(handlers: RpcHandlers) {
  const client = getBusClient()
  const receiver = client.createReceiver(QUEUE_RPC_REQUESTS)
  const replySenders = new Map<string, ServiceBusSender>()

  receiver.subscribe(
    {
      processMessage: async (message) => {
        const { action, payload } = (message.body ?? {}) as { action?: string; payload?: unknown }

        let body: unknown
        let ok = true
        try {
          const handler = action ? handlers[action] : undefined
          if (!handler) throw new Error(`Acción desconocida: ${action}`)
          body = await handler(payload)
        } catch (error) {
          ok = false
          body = { error: error instanceof Error ? error.message : String(error) }
        }

        if (message.replyTo && message.replyToSessionId) {
          let sender = replySenders.get(message.replyTo)
          if (!sender) {
            sender = client.createSender(message.replyTo)
            replySenders.set(message.replyTo, sender)
          }
          await sender.sendMessages({
            body,
            sessionId: message.replyToSessionId,
            correlationId: message.messageId,
            applicationProperties: { ok },
          })
        }
        await receiver.completeMessage(message)
      },
      processError: async (args) => {
        console.error(`[Messaging] rpc: error del receptor (${args.errorSource}): ${describeError(args.error)}`)
      },
    },
    { autoCompleteMessages: false }
  )

  return receiver
}
