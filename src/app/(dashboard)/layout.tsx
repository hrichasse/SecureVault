import { getAuthUser } from '@/modules/auth/auth.service'
import { redirect } from 'next/navigation'
import { mapDbRoleToAppRole, getRoleLabel } from '@/lib/role-access'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authUser = await getAuthUser()
  if (!authUser) redirect('/login')

  // Enforcement de 2FA: si el usuario tiene un segundo factor verificado pero la
  // sesión sigue en AAL1 (solo password), exigir el reto antes de entrar al panel.
  // El layout envuelve todas las rutas del dashboard, así que cubre todo el panel.
  const supabase = await createClient()
  const { data: { user: sbUser } } = await supabase.auth.getUser()
  const hasVerifiedFactor = (sbUser?.factors ?? []).some((f) => f.status === 'verified')
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel === 'aal1' && (aal?.nextLevel === 'aal2' || hasVerifiedFactor)) {
    redirect('/verify-2fa')
  }

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
    roleLabel: getRoleLabel(appRole),
    company: authUser.company.name,
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
