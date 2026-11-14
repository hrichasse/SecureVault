/**
 * GET /api/admin/streaming — flujo en vivo de métricas de Kafka (Server-Sent Events).
 *
 * Envía cada segundo una foto de las métricas calculadas por el consumidor del
 * servidor (lib/streaming/live-feed.ts). Solo para el ADMIN del sistema.
 * Sin KAFKA_BROKERS responde un único evento { enabled: false } y cierra.
 */
import { getAuthUser } from '@/lib/auth-utils'
import { isStreamingEnabled } from '@/lib/streaming/kafka'
import { getFeedSnapshot } from '@/lib/streaming/live-feed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const encoder = new TextEncoder()
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(request: Request) {
  const user = await getAuthUser()
  if (!user || user.role !== 'ADMIN') {
    return Response.json({ error: 'No autorizado. Solo Super Admin.' }, { status: 403 })
  }

  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // que ningún proxy acumule los eventos
  }

  if (!isStreamingEnabled()) {
    return new Response(sse({ enabled: false }), { headers })
  }

  let timer: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        try {
          controller.enqueue(sse(getFeedSnapshot()))
        } catch {
          if (timer) clearInterval(timer)
        }
      }
      push()
      timer = setInterval(push, 1000)
      request.signal.addEventListener('abort', () => {
        if (timer) clearInterval(timer)
        try {
          controller.close()
        } catch {
          /* ya cerrado */
        }
      })
    },
    cancel() {
      if (timer) clearInterval(timer)
    },
  })

  return new Response(stream, { headers })
}
