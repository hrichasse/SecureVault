/**
 * Hook de arranque de Next.js: se ejecuta una vez cuando inicia el servidor.
 * Aquí se levantan los consumidores del bus de mensajes (Azure Service Bus).
 */
export async function register() {
  // Los consumidores usan AMQP, Prisma y pdf-parse: solo existen en el runtime de
  // Node. El import debe ir dentro de este `if` (y no tras un return anticipado)
  // para que el bundler lo excluya del build del runtime Edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startConsumers } = await import('@/lib/messaging/consumers')
    startConsumers()
  }
}
