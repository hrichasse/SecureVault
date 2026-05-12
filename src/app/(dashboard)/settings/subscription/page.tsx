import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCompanySubscription, PLAN_CONFIG } from '@/modules/subscriptions/subscriptions.service'
import { SubscriptionClient } from './SubscriptionClient'

export const metadata: Metadata = { title: 'Suscripción | SecureVault AI' }

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function SubscriptionPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { company: true },
  })
  if (!dbUser) redirect('/login')

  const subscription = await getCompanySubscription(dbUser.companyId)

  // Métricas de uso actual
  const [userCount, docCount] = await Promise.all([
    prisma.user.count({ where: { companyId: dbUser.companyId } }),
    prisma.document.count({ where: { companyId: dbUser.companyId } }),
  ])

  const currentPlan = subscription?.plan ?? 'FREE'
  const planConfig = PLAN_CONFIG[currentPlan]

  // Extraer parámetros de búsqueda (string simple)
  const success = typeof searchParams.success === 'string' ? searchParams.success : undefined
  const cancelled = typeof searchParams.cancelled === 'string' ? searchParams.cancelled : undefined
  const error = typeof searchParams.error === 'string' ? searchParams.error : undefined
  const planParam = typeof searchParams.plan === 'string' ? searchParams.plan : undefined
  const amount = typeof searchParams.amount === 'string' ? searchParams.amount : undefined

  const notification = success === 'true'
    ? { type: 'success' as const, plan: planParam, amount }
    : cancelled === 'true'
    ? { type: 'cancelled' as const }
    : error
    ? { type: 'error' as const, code: error }
    : null

  return (
    <SubscriptionClient
      companyId={dbUser.companyId}
      companyName={dbUser.company.name}
      currentPlan={currentPlan}
      planConfig={planConfig}
      subscription={subscription ? {
        status: subscription.status,
        expiresAt: subscription.expiresAt?.toISOString() ?? null,
        maxUsers: subscription.maxUsers,
        maxDocuments: subscription.maxDocuments,
      } : null}
      usage={{ users: userCount, documents: docCount }}
      notification={notification}
    />
  )
}
