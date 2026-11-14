/**
 * GET|POST /api/payments/transbank/callback
 *
 * Callback de Transbank después del pago.
 * Transbank redirige aquí con token_ws (por GET o POST).
 *
 * Plan, empresa y monto se toman de la respuesta de `commit` (servidor a
 * servidor), nunca de la URL: el navegador puede alterarla para activar otro
 * plan u otra empresa con un mismo pago.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } from 'transbank-sdk'
import {
  upgradeSubscription,
  decodePaymentSession,
  PLAN_CHARGE_CLP,
} from '@/modules/subscriptions/subscriptions.service'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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

async function handleCallback(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  // token_ws puede llegar por GET (query) o por POST (form body)
  let tokenWs: string | null = searchParams.get('token_ws')
  let tbkToken: string | null = searchParams.get('TBK_TOKEN')

  // Transbank envía token_ws por POST (form body) en el redirect final
  if (request.method === 'POST') {
    try {
      const formData = await request.formData()
      if (formData.has('token_ws')) tokenWs = formData.get('token_ws') as string
      if (formData.has('TBK_TOKEN')) tbkToken = formData.get('TBK_TOKEN') as string
    } catch (e) {
      console.error('[Transbank] Error parsing formData:', e)
    }
  }



  // TBK_TOKEN (sin token_ws) = usuario canceló
  if (tbkToken && !tokenWs) {
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?cancelled=true`)
  }

  if (!tokenWs) {
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=missing_params`)
  }

  try {
    const tx = getWebpayTx()
    const result: any = await tx.commit(tokenWs)

    // El SDK devuelve el JSON de la API tal cual (snake_case); se acepta camelCase por compatibilidad
    const respCode = result.response_code ?? result.responseCode
    const respStatus = result.status
    const respBuyOrder = result.buy_order ?? result.buyOrder
    const respAmount = Number(result.amount)
    const session = decodePaymentSession(result.session_id ?? result.sessionId)

    // responseCode 0 = pago autorizado
    if (respCode === 0 && respStatus === 'AUTHORIZED') {
      // El monto cobrado debe ser exactamente el precio del plan que dice el sessionId
      if (!session || respAmount !== PLAN_CHARGE_CLP[session.plan]) {
        console.error('[Transbank] Pago autorizado que no corresponde a ningún plan:', {
          buyOrder: respBuyOrder,
          amount: respAmount,
          sessionId: result.session_id ?? result.sessionId,
        })
        return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=payment_mismatch`)
      }

      await upgradeSubscription(session.companyId, session.plan, tokenWs, respBuyOrder)
      return NextResponse.redirect(
        `${BASE_URL}/settings/subscription?success=true&plan=${session.plan}&amount=${respAmount}`
      )
    } else {
      console.error('[Transbank] Payment rejected:', { respCode, respStatus, result })
      return NextResponse.redirect(
        `${BASE_URL}/settings/subscription?error=payment_rejected&code=${respCode}`
      )
    }
  } catch (error) {
    console.error('[Transbank] Commit error:', error)
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=commit_failed`)
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request)
}

export async function POST(request: NextRequest) {
  return handleCallback(request)
}
