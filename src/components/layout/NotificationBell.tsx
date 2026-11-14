'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NotificationItem {
  id: string
  title: string
  body: string
  href: string | null
  readAt: string | null
  createdAt: string
}

const REFRESH_MS = 15_000

/** Campana del panel: avisos generados por el suscriptor "notifier" del bus de mensajes. */
export function NotificationBell() {
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  /** Avisos ya mostrados; null hasta la primera carga, que no se anuncia. */
  const known = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const { data } = await res.json()
      const fresh: NotificationItem[] = data.items

      // Lo que llegó desde la última consulta aparece también como aviso emergente.
      const arrived = known.current ? fresh.filter((n) => !n.readAt && !known.current!.has(n.id)) : []
      if (arrived.length === 1) toast({ title: arrived[0].title, description: arrived[0].body })
      if (arrived.length > 1) toast({ title: `${arrived.length} avisos nuevos`, description: arrived[0].title })
      known.current = new Set(fresh.map((n) => n.id))

      setItems(fresh)
      setUnread(data.unreadCount)
    } catch {
      // Sin conexión: se conserva lo último mostrado y se reintenta en el próximo ciclo.
    }
  }, [toast])

  useEffect(() => {
    load()
    // Con la pestaña oculta no se consulta; al volver a ella se actualiza al tiro.
    const timer = setInterval(() => !document.hidden && load(), REFRESH_MS)
    const onVisible = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const handleOpenChange = (open: boolean) => {
    if (open) {
      load()
      return
    }
    // Al cerrar se dan por leídos: mientras está abierto, los nuevos se ven destacados.
    if (unread > 0) {
      setUnread(0)
      setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                onClick={() => n.href && router.push(n.href)}
              >
                <div className="flex items-center gap-2 w-full">
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  <span className={`text-sm leading-tight ${n.readAt ? 'text-foreground' : 'font-semibold text-foreground'}`}>
                    {n.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground leading-snug">{n.body}</span>
                <span className="text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
