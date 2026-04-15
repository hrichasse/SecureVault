import type { UserRole } from '@/types'

export type AppRole = 'admin' | 'usuario' | 'cliente' | 'notario'

/**
 * Maps the Prisma UserRole enum to the frontend display role
 */
export function mapDbRoleToAppRole(dbRole: UserRole): AppRole {
  switch (dbRole) {
    case 'ADMIN': return 'admin'
    case 'REVIEWER': return 'usuario'
    case 'USER': return 'cliente'
    case 'NOTARY': return 'notario'
  }
}

/**
 * Maps the frontend display role to Prisma enum
 */
export function mapAppRoleToDbRole(appRole: AppRole): UserRole {
  switch (appRole) {
    case 'admin': return 'ADMIN'
    case 'usuario': return 'REVIEWER'
    case 'cliente': return 'USER'
    case 'notario': return 'NOTARY'
  }
}

/**
 * Human-readable label for each role
 */
export function getRoleLabel(role: AppRole): string {
  switch (role) {
    case 'admin': return 'Administrador'
    case 'usuario': return 'Usuario'
    case 'cliente': return 'Cliente'
    case 'notario': return 'Notario/Certificador'
  }
}

/**
 * Navigation items visible per role
 */
export interface NavItem {
  title: string
  url: string
  icon: string // lucide icon name
  roles: AppRole[]
}

export const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: 'LayoutDashboard', roles: ['admin', 'usuario', 'cliente', 'notario'] },
  { title: 'Documentos', url: '/documents', icon: 'FileText', roles: ['admin', 'usuario', 'cliente', 'notario'] },
  { title: 'Solicitudes', url: '/requests', icon: 'Send', roles: ['admin', 'usuario', 'cliente'] },
  { title: 'Incidentes', url: '/incidents', icon: 'AlertTriangle', roles: ['admin', 'usuario'] },
  { title: 'Certificaciones', url: '/certifications', icon: 'ShieldCheck', roles: ['admin', 'notario'] },
  { title: 'Auditoría', url: '/audit', icon: 'ClipboardList', roles: ['admin'] },
]

export const adminNavItems: NavItem[] = [
  { title: 'Panel Admin', url: '/admin', icon: 'Users', roles: ['admin'] },
]

export const notaryNavItems: NavItem[] = [
  { title: 'Panel Notarial', url: '/certifications', icon: 'Scale', roles: ['notario'] },
]

/**
 * Checks if a role can access a given path
 */
export function hasAccess(role: AppRole, path: string): boolean {
  const allItems = [...mainNavItems, ...adminNavItems, ...notaryNavItems]
  const item = allItems.find(i => path.startsWith(i.url))
  if (!item) return true // Unknown routes are allowed (handled by middleware)
  return item.roles.includes(role)
}
