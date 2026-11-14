/**
 * @jest-environment node
 */
import { describeError } from '@/lib/messaging/bus'

describe('describeError', () => {
  it('une nombre, código y mensaje, omitiendo lo que falte', () => {
    const busy = Object.assign(new Error('The namespace is being throttled'), { name: 'ServiceBusError', code: 'ServiceBusy' })

    expect(describeError(busy)).toBe('ServiceBusError · ServiceBusy · The namespace is being throttled')
    expect(describeError(new Error('sin código'))).toBe('Error · sin código')
  })

  it('un fallo de conexión (AggregateError sin mensaje) muestra sus causas una sola vez', () => {
    const refused = () => Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    // Node prueba IPv6 e IPv4: llegan dos errores iguales dentro del AggregateError.
    const error = new AggregateError([refused(), refused()], '')

    expect(describeError(error)).toBe('AggregateError · Error · ECONNREFUSED · connect ECONNREFUSED')
  })

  it('lo que no es un Error se muestra tal cual', () => {
    expect(describeError('boom')).toBe('boom')
  })
})
