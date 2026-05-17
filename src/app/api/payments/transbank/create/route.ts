/**
 * POST /api/payments/transbank/create
 *
 * Inicia una transacción Webpay Plus para upgrade de suscripción.
 * Retorna { url, token } para redirigir al usuario al formulario de pago de Transbank.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } from 'transbank-sdk'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { SubscriptionPlan } from '@prisma/client'

// Precios en pesos CLP (entero, sin decimales)
const PLAN_PRICES: Record<string, number> = {
  PRO: 29990,
  ENTERPRISE: 99990,
}

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
    // 1. Autenticar usuario
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener datos de la solicitud
    const { plan } = await request.json() as { plan: SubscriptionPlan }
    if (!plan || !['PRO', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    // 3. Obtener empresa del usuario
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { company: true },
    })
    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // 4. Crear la transacción
    const tx = getWebpayTx()
    const buyOrder = `SV-${dbUser.companyId.slice(0, 8)}-${Date.now()}`
    const sessionId = `sv-${dbUser.id.slice(0, 8)}`
    const amount = PLAN_PRICES[plan]
    // plan y companyId van como query params en la returnUrl (Transbank los preserva)
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/transbank/callback?plan=${plan}&companyId=${dbUser.companyId}`

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
