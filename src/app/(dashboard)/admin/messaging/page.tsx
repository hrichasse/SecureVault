import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/modules/auth/auth.service'
import { MessagingClient } from './MessagingClient'

export const metadata: Metadata = { title: 'Mensajería' }

/** Panel del bus de mensajes (Azure Service Bus). Solo para el ADMIN del sistema. */
export default async function MessagingPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/dashboard')

  return <MessagingClient />
}
