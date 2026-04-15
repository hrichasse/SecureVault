import type { UserRole } from '@/types'

export type AppRole = 'admin' | 'admin_empresa' | 'cliente' | 'notario'

/**
 * Maps the Prisma UserRole enum to the frontend display role
 */
export function mapDbRoleToAppRole(dbRole: UserRole): AppRole {
  switch (dbRole) {
    case 'ADMIN': return 'admin'
    case 'ADMIN_COMPANY': return 'admin_empresa'
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
    case 'admin_empresa': return 'ADMIN_COMPANY'
    case 'cliente': return 'USER'
    case 'notario': return 'NOTARY'
  }
}

/**
 * Human-readable label for each role
 * ADMIN     = Administrador del sistema (nosotros, los creadores)
 * ADMIN_COMPANY  = Administrador de empresa cliente
 * USER      = Trabajador (empleado de la empresa)
 * NOTARY    = Notario/Certificador
 */
export function getRoleLabel(role: AppRole): string {
  switch (role) {
    case 'admin': return 'Administrador del Sistema'
    case 'admin_empresa': return 'Administrador de Empresa'
    case 'cliente': return 'Trabajador'
    case 'notario': return 'Notario/Certificador'
  }
}

/**
 * Short label for display in badges and tables
 */
export function getRoleShortLabel(role: AppRole): string {
  switch (role) {
    case 'admin': return 'Admin Sistema'
    case 'admin_empresa': return 'Admin Empresa'
    case 'cliente': return 'Trabajador'
    case 'notario': return 'Notario'
  }
}

/**
 * Navigation items visible per role
 *
 * admin   → todo (+ panel admin → gestión de todos los usuarios del sistema)
 * admin_empresa → dashboard, docs, solicitudes, incidentes, certificaciones, equipo
 * cliente → dashboard, docs, solicitudes
 * notario → dashboard, docs, certificaciones
 */
export interface NavItem {
  title: string
  url: string
  icon: string // lucide icon name
  roles: AppRole[]
}

export const mainNavItems: NavItem[] = [
  { title: 'Dashboard',       url: '/dashboard',      icon: 'LayoutDashboard', roles: ['admin', 'admin_empresa', 'cliente', 'notario'] },
  { title: 'Documentos',      url: '/documents',      icon: 'FileText',        roles: ['admin', 'admin_empresa', 'cliente', 'notario'] },
  { title: 'Solicitudes',     url: '/requests',       icon: 'Send',            roles: ['admin', 'admin_empresa', 'cliente'] },
  { title: 'Incidentes',      url: '/incidents',      icon: 'AlertTriangle',   roles: ['admin', 'admin_empresa'] },
  { title: 'Certificaciones', url: '/certifications', icon: 'ShieldCheck',     roles: ['admin', 'admin_empresa', 'notario'] },
  { title: 'Auditoría',       url: '/audit',          icon: 'ClipboardList',   roles: ['admin', 'admin_empresa'] },
]

export const adminNavItems: NavItem[] = [
  // Visible para admin del sistema y admin de empresa
  { title: 'Gestión de Equipo', url: '/admin', icon: 'Users', roles: ['admin', 'admin_empresa'] },
]

export const notaryNavItems: NavItem[] = []

/**
 * Checks if a role can access a given path
 */
export function hasAccess(role: AppRole, path: string): boolean {
  const allItems = [...mainNavItems, ...adminNavItems, ...notaryNavItems]
  const item = allItems.find(i => path.startsWith(i.url))
  if (!item) return true // Unknown routes are allowed (handled by middleware)
  return item.roles.includes(role)
}
