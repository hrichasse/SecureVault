'use client'

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Bell, Search, Shield, LogOut, Settings, User, ChevronDown, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { useRouter } from 'next/navigation'
import type { AppRole } from '@/lib/role-access'

interface DashboardUser {
  name: string
  email: string
  initials: string
  role: AppRole
  roleLabel: string
  company: string
}

const roleBadgeVariant: Record<AppRole, 'info' | 'success' | 'neutral' | 'warning'> = {
  admin: 'info',
  usuario: 'success',
  cliente: 'neutral',
  notario: 'warning',
}

function DashboardContent({ user, children }: { user: DashboardUser; children: React.ReactNode }) {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar role={user.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center justify-between px-2 sm:px-4 gap-2 sm:gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2 md:hidden">
                <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="font-bold text-sm text-foreground hidden xs:inline">SecureVault</span>
              </div>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos, solicitudes..."
                  className="pl-9 w-72 h-9 bg-muted/50 border-transparent focus:border-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Theme toggle */}
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8" title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}>
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>

              {/* Role badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md border border-border">
                <StatusBadge variant={roleBadgeVariant[user.role]}>{user.roleLabel}</StatusBadge>
              </div>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 h-9">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">{user.initials}</span>
                    </div>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium text-foreground leading-tight">{user.name}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{user.company} · {user.roleLabel}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground font-medium">{user.company}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/settings')}>
                    <User className="mr-2 h-4 w-4" />
                    Mi perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}

export function DashboardShell({ user, children }: { user: DashboardUser; children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardContent user={user}>
        {children}
      </DashboardContent>
    </ThemeProvider>
  )
}
