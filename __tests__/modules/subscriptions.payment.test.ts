/**
 * @jest-environment node
 */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  encodePaymentSession,
  decodePaymentSession,
  PLAN_CHARGE_CLP,
} from '@/modules/subscriptions/subscriptions.service'

describe('sessionId de Webpay (plan + empresa)', () => {
  it('ida y vuelta: lo que se codifica al crear el pago se recupera en el callback', () => {
    const sid = encodePaymentSession('PRO', 'cmabc123companyid0000000')
    expect(decodePaymentSession(sid)).toEqual({ plan: 'PRO', companyId: 'cmabc123companyid0000000' })
  })

  it('cabe en el máximo de Transbank (61 caracteres) con un cuid', () => {
    expect(encodePaymentSession('ENTERPRISE', 'c'.repeat(25)).length).toBeLessThanOrEqual(61)
  })

  it('rechaza planes que no se cobran o formatos inválidos', () => {
    expect(decodePaymentSession('FREE_cmabc')).toBeNull()
    expect(decodePaymentSession('PRO_')).toBeNull()
    expect(decodePaymentSession('_cmabc')).toBeNull()
    expect(decodePaymentSession('sv-1234abcd')).toBeNull()
    expect(decodePaymentSession(undefined)).toBeNull()
    expect(decodePaymentSession(42)).toBeNull()
  })

  it('cada plan pagado tiene un monto positivo', () => {
    expect(PLAN_CHARGE_CLP.PRO).toBe(29990)
    expect(PLAN_CHARGE_CLP.ENTERPRISE).toBe(99990)
    expect(PLAN_CHARGE_CLP.FREE).toBeUndefined()
  })
})
