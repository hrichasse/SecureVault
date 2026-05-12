/**
 * GET|POST /api/payments/transbank/callback
 *
 * Callback de Transbank después del pago.
 * Transbank puede enviar el token_ws por GET (query string) o por POST (form body).
 * El plan y companyId se extraen del sessionId codificado al crear la transacción.
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

  console.log('[Transbank Callback]', { method: request.method, hasToken: !!tokenWs, hasTbk: !!tbkToken })

  // TBK_TOKEN (sin token_ws) = usuario canceló
  if (tbkToken && !tokenWs) {
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?cancelled=true`)
  }

  if (!tokenWs) {
    return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=missing_token`)
  }

  try {
    const tx = getWebpayTx()
    const result: any = await tx.commit(tokenWs)

    console.log('[Transbank] Commit result:', JSON.stringify(result))

    // Extraer plan y companyId del sessionId (formato: "PRO_<companyId>")
    const sid: string = result.sessionId || ''
    const underscoreIdx = sid.indexOf('_')
    const plan = sid.substring(0, underscoreIdx) as SubscriptionPlan
    const companyId = sid.substring(underscoreIdx + 1)

    if (!plan || !companyId) {
      console.error('[Transbank] Invalid sessionId:', sid)
      return NextResponse.redirect(`${BASE_URL}/settings/subscription?error=invalid_session`)
    }

    // responseCode 0 = pago autorizado
    if (result.responseCode === 0 && result.status === 'AUTHORIZED') {
      await upgradeSubscription(companyId, plan, tokenWs, result.buyOrder)
      return NextResponse.redirect(
        `${BASE_URL}/settings/subscription?success=true&plan=${plan}&amount=${result.amount}`
      )
    } else {
      console.error('[Transbank] Payment rejected:', result)
      return NextResponse.redirect(
        `${BASE_URL}/settings/subscription?error=payment_rejected&code=${result.responseCode}`
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
