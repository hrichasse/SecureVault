/**
 * POST /api/payments/transbank/create
 *
 * Inicia una transacción Webpay Plus para upgrade de suscripción.
 * Retorna { url, token } para redirigir al usuario al formulario de pago de Transbank.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } from 'transbank-sdk'
import { getAuthUser } from '@/lib/auth-utils'
import { PLAN_CHARGE_CLP, encodePaymentSession } from '@/modules/subscriptions/subscriptions.service'
import type { SubscriptionPlan } from '@prisma/client'

const PLAN_LABELS: Record<string, string> = {
  PRO: 'Plan PRO - SecureVault',
  ENTERPRISE: 'Plan Enterprise - SecureVault',
}

function getWebpayTx() {
  const isProd = process.env.TBK_ENVIRONMENT === 'production'
  if (isProd && process.env.TBK_COMMERCE_CODE && process.env.TBK_API_KEY) {
    return new (WebpayPlus as any).Transaction(
      new (Options as any)(process.env.TBK_COMMERCE_CODE, process.env.TBK_API_KEY, (Environment as any).Production)
    )
  }
  return new (WebpayPlus as any).Transaction(
    new (Options as any)(
      (IntegrationCommerceCodes as any).WEBPAY_PLUS,
      (IntegrationApiKeys as any).WEBPAY,
      (Environment as any).Integration
    )
  )
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticar usuario (incluye el segundo factor si lo tiene activo)
    const dbUser = await getAuthUser()
    if (!dbUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener datos de la solicitud
    const { plan } = await request.json() as { plan: SubscriptionPlan }
    const amount = plan ? PLAN_CHARGE_CLP[plan] : undefined
    if (!amount) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    // 3. Crear la transacción. Plan y empresa viajan en el sessionId, que el
    //    callback lee de la respuesta de Transbank (no de la URL de retorno).
    const tx = getWebpayTx()
    const buyOrder = `SV-${dbUser.companyId.slice(0, 8)}-${Date.now()}`
    const sessionId = encodePaymentSession(plan, dbUser.companyId)
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/transbank/callback`

    const response: any = await tx.create(buyOrder, sessionId, amount, returnUrl)

    return NextResponse.json({
      url: response.url,
      token: response.token,
      buyOrder,
      amount,
      planLabel: PLAN_LABELS[plan],
    })
  } catch (error) {
    console.error('[Transbank] Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago. Por favor intenta de nuevo.' },
      { status: 500 }
    )
  }
}
