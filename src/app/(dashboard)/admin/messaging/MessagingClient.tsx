'use client'

import { useCallback, useEffect, useState } from 'react'
import { Inbox, RefreshCw, Activity, AlertTriangle, RotateCcw, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/hooks/use-toast'

interface SubscriptionStatus {
  name: string
  subjects: string[]
  maxDeliveryCount: number
  lockDuration: string
  timeToLive: string
  active: number
  deadLettered: number
}

interface DeadLetterItem {
  subscription: string
  sequenceNumber: string
  messageId: string
  eventType: string
  reason: string
  description: string
  attempts: number
  enqueuedAt: string | null
  body: unknown
}

interface MessagingState {
  enabled: boolean
  broker?: 'emulator' | 'azure'
  peekLimit?: number
  subscriptions?: SubscriptionStatus[]
  deadLetters?: DeadLetterItem[]
}

interface ConsumerStats {
  processed: number
  retried: number
  deadLettered: number
}

interface PingResult {
  roundTripMs: number
  worker: { pid: number; uptimeSeconds: number; stats: Record<string, ConsumerStats> }
}

const SUBSCRIPTION_LABELS: Record<string, string> = {
  indexer: 'Indexador RAG',
  notifier: 'Notificaciones',
}

/** "PT1M" → "1 min", "P7D" → "7 d". Solo las formas que usa la topología. */
function humanizeDuration(iso: string): string {
  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!match) return iso
  const [, d, h, m, s] = match
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(' ') || iso
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`
}

export function MessagingClient() {
  const [state, setState] = useState<MessagingState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pinging, setPinging] = useState(false)
  const [ping, setPing] = useState<PingResult | null>(null)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/messaging')
      const json = await res.json()
      if (!res.ok) {
        setLoadError(json.error ?? 'No se pudo consultar el broker')
        return
      }
      setLoadError(null)
      setState(json.data)
    } catch {
      setLoadError('Error de conexión con el servidor')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handlePing() {
    setPinging(true)
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPing(null)
        toast({ title: 'El worker no respondió', description: json.error, variant: 'destructive' })
        return
      }
      setPing(json.data)
    } catch {
      toast({ title: 'Error', description: 'No se pudo contactar al servidor', variant: 'destructive' })
    } finally {
      setPinging(false)
    }
  }

  async function handleDeadLetter(item: DeadLetterItem, action: 'reprocess' | 'discard') {
    if (action === 'discard' && !confirm('¿Descartar este mensaje? Se eliminará de la cola de errores y no se procesará.')) return

    setBusyMessage(item.sequenceNumber + item.subscription)
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscription: item.subscription, sequenceNumber: item.sequenceNumber }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          title: action === 'reprocess' ? 'El reproceso volvió a fallar' : 'No se pudo descartar',
          description: json.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: action === 'reprocess' ? 'Mensaje reprocesado' : 'Mensaje descartado' })
      await load()
    } catch {
      toast({ title: 'Error', description: 'No se pudo contactar al servidor', variant: 'destructive' })
    } finally {
      setBusyMessage(null)
    }
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Inbox className="w-6 h-6 text-primary" />
        Mensajería
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Bus de mensajes (Azure Service Bus): suscripciones, mensajes en cola y cola de errores.
      </p>
    </div>
  )

  if (!state && !loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card h-36 animate-pulse" />
          <div className="card h-36 animate-pulse" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-6 flex items-start gap-3 border-destructive/30">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-3">
            <p className="text-sm text-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Reintentar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!state?.enabled) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-6 text-sm text-muted-foreground">
          La mensajería no está configurada en este entorno (falta <code className="font-mono">SERVICEBUS_CONNECTION_STRING</code>).
          Los eventos se procesan en línea, sin cola ni reintentos.
        </div>
      </div>
    )
  }

  const subscriptions = state.subscriptions ?? []
  const deadLetters = state.deadLetters ?? []
  const count = (n: number) => (n >= (state.peekLimit ?? Infinity) ? `${n}+` : String(n))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {header}
        <div className="flex items-center gap-2">
          <StatusBadge variant={state.broker === 'azure' ? 'success' : 'info'}>
            {state.broker === 'azure' ? 'Azure' : 'Emulador local'}
          </StatusBadge>
          <Button variant="outline" size="sm" onClick={handlePing} disabled={pinging}>
            {pinging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            Probar worker
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Alerta: hay mensajes que no se pudieron procesar */}
      {deadLetters.length > 0 && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {deadLetters.length === 1
              ? 'Hay 1 mensaje en la cola de errores que requiere revisión.'
              : `Hay ${count(deadLetters.length)} mensajes en la cola de errores que requieren revisión.`}
          </p>
        </div>
      )}

      {/* Resultado del request/reply */}
      {ping && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            El worker respondió en {ping.roundTripMs} ms
          </span>
          <span className="text-muted-foreground">
            PID {ping.worker.pid} · activo hace {formatUptime(ping.worker.uptimeSeconds)}
          </span>
          {Object.entries(ping.worker.stats).map(([name, s]) => (
            <span key={name} className="text-muted-foreground">
              {SUBSCRIPTION_LABELS[name] ?? name}: {s.processed} procesados · {s.retried} reintentos · {s.deadLettered} a errores
            </span>
          ))}
        </div>
      )}

      {/* Suscripciones del topic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subscriptions.map((sub) => (
          <div key={sub.name} className="card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-card-foreground">{SUBSCRIPTION_LABELS[sub.name] ?? sub.name}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{sub.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">En cola</p>
                <p className="text-2xl font-black text-foreground">{count(sub.active)}</p>
              </div>
              <div className={`rounded-lg p-3 ${sub.deadLettered > 0 ? 'bg-destructive/10' : 'bg-muted/40'}`}>
                <p className="text-xs text-muted-foreground">En cola de errores</p>
                <p className={`text-2xl font-black ${sub.deadLettered > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {count(sub.deadLettered)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sub.subjects.map((subject) => (
                <span key={subject} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {subject}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-3 border-t border-border">
              Hasta {sub.maxDeliveryCount} intentos · bloqueo de {humanizeDuration(sub.lockDuration)} · retención de{' '}
              {humanizeDuration(sub.timeToLive)}
            </p>
          </div>
        ))}
      </div>

      {/* Cola de errores (DLQ) */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-card-foreground">Cola de errores (DLQ)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Mensajes que agotaron sus reintentos, fallaron con un error permanente o expiraron sin procesarse.
          </p>
        </div>
        {deadLetters.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay mensajes en la cola de errores.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evento</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intentos</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Encolado</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map((item) => {
                  const busy = busyMessage === item.sequenceNumber + item.subscription
                  return (
                    <tr key={item.subscription + item.sequenceNumber} className="border-b border-border last:border-0 align-top">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-card-foreground font-mono">{item.eventType}</div>
                        <div className="text-xs text-muted-foreground">{SUBSCRIPTION_LABELS[item.subscription] ?? item.subscription}</div>
                        <details className="mt-1.5">
                          <summary className="text-xs text-primary cursor-pointer">Ver contenido</summary>
                          <pre className="mt-1.5 text-[11px] bg-muted/40 rounded-md p-2 max-w-xs overflow-x-auto">
                            {JSON.stringify(item.body, null, 2)}
                          </pre>
                        </details>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <StatusBadge variant="danger">{item.reason}</StatusBadge>
                        <p className="text-xs text-muted-foreground mt-1.5 break-words">{item.description}</p>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">{item.attempts}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {item.enqueuedAt
                          ? new Date(item.enqueuedAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-primary" disabled={busy} onClick={() => handleDeadLetter(item, 'reprocess')}>
                            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
                            Reprocesar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={busy}
                            onClick={() => handleDeadLetter(item, 'discard')}
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            Descartar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
