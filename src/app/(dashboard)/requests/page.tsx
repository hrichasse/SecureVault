import { redirect } from 'next/navigation'
import { getAuthUser } from '@/modules/auth/auth.service'
import { RequestsClient } from './RequestsClient'

/**
 * Solicitudes de acceso — panel de revisión/aprobación.
 * Solo lo pueden ver y usar ADMIN (sistema) y ADMIN_COMPANY (admin de empresa).
 * Un USER (trabajador) o NOTARY no debe gestionar solicitudes: se redirige.
 */
export default async function RequestsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.role !== 'ADMIN' && user.role !== 'ADMIN_COMPANY') {
    redirect('/dashboard')
  }

  return <RequestsClient />
}
