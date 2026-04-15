import { getAuthUser } from '@/modules/auth/auth.service'
import { redirect } from 'next/navigation'
import { mapDbRoleToAppRole } from '@/lib/role-access'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authUser = await getAuthUser()
  if (!authUser) redirect('/login')

  const appRole = mapDbRoleToAppRole(authUser.role)
  const initials = authUser.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const user = {
    name: authUser.name,
    email: authUser.email,
    initials,
    role: appRole,
    roleLabel: (() => {
      switch (appRole) {
        case 'admin': return 'Administrador'
        case 'usuario': return 'Usuario'
        case 'cliente': return 'Cliente'
        case 'notario': return 'Notario/Certificador'
      }
    })(),
    company: authUser.company.name,
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
