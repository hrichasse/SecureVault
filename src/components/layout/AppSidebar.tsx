'use client'

import {
  LayoutDashboard,
  FileText,
  Send,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  Users,
  Shield,
  Scale,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/lib/role-access'

const iconMap = {
  LayoutDashboard,
  FileText,
  Send,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  Users,
  Scale,
} as const

const allItems = [
  { title: 'Dashboard', url: '/dashboard', icon: 'LayoutDashboard' as const, roles: ['admin', 'usuario', 'cliente', 'notario'] as AppRole[] },
  { title: 'Documentos', url: '/documents', icon: 'FileText' as const, roles: ['admin', 'usuario', 'cliente', 'notario'] as AppRole[] },
  { title: 'Solicitudes', url: '/requests', icon: 'Send' as const, roles: ['admin', 'usuario', 'cliente'] as AppRole[] },
  { title: 'Incidentes', url: '/incidents', icon: 'AlertTriangle' as const, roles: ['admin', 'usuario'] as AppRole[] },
  { title: 'Certificaciones', url: '/certifications', icon: 'ShieldCheck' as const, roles: ['admin', 'notario'] as AppRole[] },
  { title: 'Auditoría', url: '/audit', icon: 'ClipboardList' as const, roles: ['admin'] as AppRole[] },
]

const adminItems = [
  { title: 'Panel Admin', url: '/admin', icon: 'Users' as const },
]

const notarioItems = [
  { title: 'Panel Notarial', url: '/certifications', icon: 'Scale' as const },
]

interface AppSidebarProps {
  role: AppRole
}

export function AppSidebar({ role }: AppSidebarProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const pathname = usePathname()

  const visibleItems = allItems.filter((item) => item.roles.includes(role))

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-base tracking-tight text-foreground">
              SecureVault
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = iconMap[item.icon]
                const isActive = pathname === item.url || pathname.startsWith(item.url + '/')
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                          isActive && 'bg-primary/10 text-primary font-semibold'
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const Icon = iconMap[item.icon]
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.url}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                            isActive && 'bg-primary/10 text-primary font-semibold'
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {role === 'notario' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Notarial
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {notarioItems.map((item) => {
                  const Icon = iconMap[item.icon]
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.url}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                            isActive && 'bg-primary/10 text-primary font-semibold'
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
