import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/modules/auth/auth.service'
import { StreamingClient } from './StreamingClient'

export const metadata: Metadata = { title: 'Streaming (Kafka)' }

/** Panel en vivo del streaming de eventos de negocio (Apache Kafka). Solo para el ADMIN del sistema. */
export default async function StreamingPage() {
  const user = await getAuthUser({ allowPendingSecondFactor: true }) // el layout exige el 2FA
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/dashboard')

  return <StreamingClient />
}
