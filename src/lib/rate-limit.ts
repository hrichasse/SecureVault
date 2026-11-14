/**
 * Límite de solicitudes en memoria (ventana deslizante por clave).
 *
 * Suficiente para frenar abusos de un endpoint caro (p. ej. el asistente, que
 * consume cuota de Gemini). Es por instancia: con varias instancias de App
 * Service cada una cuenta por separado.
 */

const buckets = new Map<string, number[]>()

/**
 * Registra un intento y dice si está permitido.
 * @returns { allowed, retryAfterSec } — retryAfterSec > 0 si se superó el límite
 */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) }
  }
  recent.push(now)
  buckets.set(key, recent)

  // Limpieza ocasional para que el mapa no crezca sin límite
  if (buckets.size > 5000) {
    buckets.forEach((times, k) => {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k)
    })
  }
  return { allowed: true, retryAfterSec: 0 }
}
