/**
 * settlement.ts — Qué hacer con un mensaje cuando su handler falla.
 *
 * Lógica pura (sin SDK ni I/O) para poder testearla aislada:
 *   - Error permanente  → DLQ de inmediato (reintentar no lo arregla).
 *   - Error transitorio → reintento con backoff exponencial.
 *   - Último intento    → DLQ, conservando el último error para diagnóstico.
 */

/** Error que no se arregla reintentando (PDF corrupto, mensaje mal formado...). */
export class PermanentError extends Error {
  constructor(
    /** Código corto que queda como DeadLetterReason. */
    public readonly reason: string,
    message: string
  ) {
    super(message)
    this.name = 'PermanentError'
  }
}

export type Settlement =
  | { action: 'retry'; delayMs: number }
  | { action: 'dead-letter'; reason: string; description: string }

const MAX_BACKOFF_MS = 30_000
const MAX_DESCRIPTION_LENGTH = 1024

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.slice(0, MAX_DESCRIPTION_LENGTH)
}

/**
 * @param deliveryCount    Entregas previas del mensaje (0 en la primera entrega).
 * @param maxDeliveryCount Límite configurado en la suscripción.
 * @param baseDelayMs      Base del backoff: base, 2·base, 4·base... con tope de 30s.
 */
export function decideSettlement(
  error: unknown,
  deliveryCount: number,
  maxDeliveryCount: number,
  baseDelayMs: number
): Settlement {
  if (error instanceof PermanentError) {
    return { action: 'dead-letter', reason: error.reason, description: describe(error) }
  }

  const attempt = deliveryCount + 1
  if (attempt >= maxDeliveryCount) {
    return {
      action: 'dead-letter',
      reason: 'MaxDeliveryCountExceeded',
      description: `Agotados ${attempt} intentos. Último error: ${describe(error)}`.slice(0, MAX_DESCRIPTION_LENGTH),
    }
  }

  return { action: 'retry', delayMs: Math.min(baseDelayMs * 2 ** deliveryCount, MAX_BACKOFF_MS) }
}
