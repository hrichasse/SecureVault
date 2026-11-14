import { decideSettlement, PermanentError } from '@/lib/messaging/settlement'

const MAX = 5
const BASE = 2_000

describe('decideSettlement', () => {
  it('reintenta un fallo transitorio con backoff exponencial', () => {
    const delays = [0, 1, 2, 3].map((deliveryCount) => decideSettlement(new Error('timeout'), deliveryCount, MAX, BASE))

    expect(delays).toEqual([
      { action: 'retry', delayMs: 2_000 },
      { action: 'retry', delayMs: 4_000 },
      { action: 'retry', delayMs: 8_000 },
      { action: 'retry', delayMs: 16_000 },
    ])
  })

  it('limita el backoff a 30 segundos', () => {
    expect(decideSettlement(new Error('x'), 8, 20, BASE)).toEqual({ action: 'retry', delayMs: 30_000 })
  })

  it('en el último intento manda a la DLQ conservando el último error', () => {
    // La primera entrega llega con deliveryCount 0, así que la quinta es deliveryCount 4.
    const decision = decideSettlement(new Error('Storage no disponible'), 4, MAX, BASE)

    expect(decision).toEqual({
      action: 'dead-letter',
      reason: 'MaxDeliveryCountExceeded',
      description: 'Agotados 5 intentos. Último error: Storage no disponible',
    })
  })

  it('manda un error permanente a la DLQ en el primer intento, con su propio motivo', () => {
    const decision = decideSettlement(new PermanentError('PdfUnparseable', 'El PDF no se pudo leer'), 0, MAX, BASE)

    expect(decision).toEqual({ action: 'dead-letter', reason: 'PdfUnparseable', description: 'El PDF no se pudo leer' })
  })

  it('acepta errores que no son instancias de Error y recorta descripciones enormes', () => {
    expect(decideSettlement('falló', 0, MAX, BASE)).toEqual({ action: 'retry', delayMs: 2_000 })

    const decision = decideSettlement(new PermanentError('X', 'e'.repeat(5_000)), 0, MAX, BASE)
    expect(decision.action).toBe('dead-letter')
    if (decision.action === 'dead-letter') expect(decision.description).toHaveLength(1024)
  })
})
