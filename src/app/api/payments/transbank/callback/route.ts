/**
 * GET|POST /api/payments/transbank/callback
 *
 * Callback de Transbank después del pago.
 * Transbank redirige aquí con token_ws (por GET o POST).
 * plan y companyId vienen como query params en la returnUrl.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } from 'transbank-sdk'
import { upgradeSubscription } from '@/modules/subscriptions/subscriptions.service'
import type { SubscriptionPlan } from '@prisma/client'

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

  // plan y companyId vienen como query params en la returnUrl
  const plan = searchParams.get('plan') as SubscriptionPlan | null
  const companyId = searchParams.get('companyId')

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

  // Validar que tenemos todos los datos necesarios
  if (!tokenWs || !plan || !companyId) {
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=missing_params`)
  }

  try {
    const tx = getWebpayTx()
    const result: any = await tx.commit(tokenWs)



    // Transbank SDK puede devolver snake_case o camelCase dependiendo de la versión
    const respCode = result.response_code ?? result.responseCode
    const respStatus = result.status
    const respBuyOrder = result.buy_order ?? result.buyOrder
    const respAmount = result.amount

    // responseCode 0 = pago autorizado
    if (respCode === 0 && respStatus === 'AUTHORIZED') {
      await upgradeSubscription(companyId, plan, tokenWs, respBuyOrder)
      return NextResponse.redirect(
        `${BASE_URL}/settings/subscription?success=true&plan=${plan}&amount=${respAmount}`
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
