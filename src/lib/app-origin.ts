/**
 * Origen público de la app para armar redirecciones y enlaces absolutos.
 *
 * En Azure el Host puede llegar como el contenedor interno (xxxxx:8080), así
 * que fuera de localhost se usa siempre el dominio público.
 */
export const PUBLIC_APP_ORIGIN = 'https://securevault-ai.azurewebsites.net'

export function getAppOrigin(host: string | null | undefined): string {
  const h = host ?? ''
  if (h.includes('localhost') || h.includes('127.0.0.1')) return `http://${h}`
  return PUBLIC_APP_ORIGIN
}

/**
 * Ruta interna segura para redirigir después de autenticar: debe empezar con
 * una sola "/" (evita redirecciones abiertas a otro dominio como "//evil.com").
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  return next
}
