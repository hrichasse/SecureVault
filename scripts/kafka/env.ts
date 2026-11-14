/**
 * Entorno común de los scripts de Kafka: lee .env.local / .env y, si no hay
 * KAFKA_BROKERS, usa el broker local de infra/kafka (localhost:9092).
 * Se importa PRIMERO en cada script, antes que los módulos que leen el entorno.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local', quiet: true })
require('dotenv').config({ path: '.env', quiet: true })
/* eslint-enable @typescript-eslint/no-require-imports */

process.env.KAFKA_BROKERS ||= 'localhost:9092'

// kafkajs (sin mantenimiento desde 2023) programa a veces un timeout negativo y
// Node 24+ avisa con TimeoutNegativeWarning. Es inofensivo (Node usa 1 ms):
// se silencia solo ese aviso para que no ensucie la salida de la demo.
const emitWarning = process.emitWarning.bind(process)
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const name = typeof warning === 'string' ? (typeof rest[0] === 'string' ? rest[0] : (rest[0] as { type?: string })?.type) : warning.name
  if (name === 'TimeoutNegativeWarning') return
  return (emitWarning as (...a: unknown[]) => void)(warning, ...rest)
}) as typeof process.emitWarning

/** Lee un argumento --nombre=valor de la línea de comandos. */
export function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  if (found) return found.slice(prefix.length)
  return process.argv.includes(`--${name}`) ? 'true' : fallback
}

export const time = (d = new Date()) => d.toTimeString().slice(0, 8)

export const LEVEL_COLOR: Record<string, string> = {
  BAJO: '\x1b[32m', // verde
  MEDIO: '\x1b[33m', // amarillo
  ALTO: '\x1b[38;5;208m', // naranjo
  CRITICO: '\x1b[31m', // rojo
}
export const RESET = '\x1b[0m'
export const DIM = '\x1b[2m'
export const BOLD = '\x1b[1m'
