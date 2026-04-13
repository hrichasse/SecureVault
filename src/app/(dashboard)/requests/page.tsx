import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRequests } from '@/modules/access-requests/request.service'
import { RequestList } from '@/components/requests/RequestList'
import type { UserRole } from '@/types'

export const metadata: Metadata = { title: 'Solicitudes de acceso' }

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true, role: true },
  })
  if (!dbUser) redirect('/login')

  const requests = await getRequests({
    companyId: dbUser.companyId,
    userId: dbUser.id,
    role: dbUser.role as UserRole,
  })

  // Format dates for Client Components
  const serializedRequests = requests.map(r => ({
    ...r,
    createdAt: new Date(r.createdAt),
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
  }))

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="page-title text-2xl">Solicitudes de Acceso</h1>
        <p className="page-subtitle">
          {dbUser.role === 'USER'
            ? 'Gestiona tus solicitudes de acceso a documentos'
            : 'Revisa y gestiona las solicitudes de acceso de tu equipo'}
        </p>
      </div>

      <RequestList requests={serializedRequests} userRole={dbUser.role as UserRole} />
    </div>
  )
}
