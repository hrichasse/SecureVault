/**
 * demo.ts — Modo demostración del panel de mensajería.
 *
 * Permite mostrar en vivo cada mecanismo del bus sin tocar datos reales: el
 * panel publica eventos "demo.requested", que recorren el mismo camino que los
 * de negocio (topic → suscripciones → ack, reintentos y DLQ). El indexador
 * simula el fallo que pide el escenario; el notifier le avisa a quien lo lanzó.
 */

import { PermanentError } from './settlement'
import type { EventEnvelope } from './events'
import type { HandlerContext } from './runner'

export const DEMO_SCENARIOS = ['publish', 'transient', 'permanent', 'exhaust', 'ttl'] as const
export type DemoScenario = (typeof DEMO_SCENARIOS)[number]

export const DEMO_LABELS: Record<DemoScenario, string> = {
  publish: 'publicar un evento',
  transient: 'falla transitoria',
  permanent: 'falla permanente',
  exhaust: 'reintentos agotados',
  ttl: 'evento con vida corta',
}

/** Vida del evento del escenario "ttl": si nadie lo consume antes, vence y va a la DLQ. */
export const DEMO_TTL_MS = 10_000

/** Entregas que falla el escenario "transient" antes de funcionar. */
const TRANSIENT_FAILURES = 2

/**
 * Lo que hace el indexador con un evento de demostración. Al reprocesarlo desde
 * el panel siempre funciona: representa que la causa del fallo ya se corrigió.
 */
export function simulateDemoProcessing(event: EventEnvelope<'demo.requested'>, context: HandlerContext): void {
  if (context.reprocess) return

  const attempt = context.deliveryCount + 1
  switch (event.data.scenario) {
    case 'permanent':
      throw new PermanentError('DemoPermanentError', 'Falla permanente simulada: reintentar no la arregla')
    case 'exhaust':
      throw new Error(`Falla transitoria simulada que no se recupera (intento ${attempt})`)
    case 'transient':
      if (attempt <= TRANSIENT_FAILURES) {
        throw new Error(`Falla transitoria simulada (intento ${attempt}; el ${TRANSIENT_FAILURES + 1}.º funcionará)`)
      }
  }
}
