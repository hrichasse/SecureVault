'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Inbox, RefreshCw, Activity, AlertTriangle, RotateCcw, Trash2, Loader2, CheckCircle2, FlaskConical, Pause, Play, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/hooks/use-toast'
import type { DemoScenario } from '@/lib/messaging/demo'

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
  /** Consumidores de la instancia que respondió (null si no están corriendo). */
  worker?: WorkerSnapshot | null
}

interface ConsumerStats {
  processed: number
  retried: number
  deadLettered: number
}

interface WorkerSnapshot {
  pid: number
  uptimeSeconds: number
  stats: Record<string, ConsumerStats>
  pausedUntil: string | null
}

interface PingResult {
  roundTripMs: number
  worker: WorkerSnapshot
}

/** Escenarios del modo demostración: cada uno muestra uno o más mecanismos del bus. */
const DEMO_ACTIONS: { scenario: DemoScenario; label: string; concepts: string; detail: string }[] = [
  { scenario: 'publish', label: 'Publicar un evento', concepts: 'Asíncrono · Pub/sub · Ack', detail: 'Lo reciben las dos suscripciones; el notifier te avisa en la campana.' },
  { scenario: 'transient', label: 'Falla transitoria', concepts: 'Ack · Reintentos', detail: 'El indexador falla 2 veces (espera 2 s y 4 s) y al tercer intento confirma.' },
  { scenario: 'permanent', label: 'Falla permanente', concepts: 'DLQ · Alerta', detail: 'Va directo a la cola de errores, sin reintentar.' },
  { scenario: 'exhaust', label: 'Agotar reintentos', concepts: 'DLQ · Alerta', detail: 'Falla 5 veces con espera creciente y cae a la cola de errores (~30 s).' },
  { scenario: 'ttl', label: 'Evento con vida de 10 s', concepts: 'Retención · Alerta', detail: 'Con los consumidores en pausa, vence y el broker lo manda a la cola de errores.' },
]

/** El panel se refresca solo mientras está a la vista. */
const AUTO_REFRESH_MS = 10_000

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
  const [demoBusy, setDemoBusy] = useState<string | null>(null)
  const { toast } = useToast()

  /** `silent`: refresco automático, sin girar el ícono de "Actualizar". */
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
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
      if (!silent) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => !document.hidden && load({ silent: true }), AUTO_REFRESH_MS)
    return () => clearInterval(timer)
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

  /** Modo demostración: publica un evento de prueba, o pausa/reanuda los consumidores. */
  async function runDemo(body: { action: string; scenario?: DemoScenario }, done: string) {
    setDemoBusy(body.scenario ?? body.action)
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'No se pudo ejecutar', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: done })
      await load({ silent: true })
    } catch {
      toast({ title: 'Error', description: 'No se pudo contactar al servidor', variant: 'destructive' })
    } finally {
      setDemoBusy(null)
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
        Bus de mensajes (Azure Service Bus): suscripciones, mensajes en cola y cola de errores. Se actualiza cada 10 s.
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
            <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing}>
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
  const pausedUntil = state.worker?.pausedUntil ?? null
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
          <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing}>
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

      {/* Consumidores en pausa (modo demostración) */}
      {pausedUntil && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-warning/10 border border-warning/30 text-warning rounded-xl p-4">
          <Pause className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium flex-1">
            Consumidores en pausa: lo que se publique queda guardado en el broker y se procesa al reanudar. Si no los
            reanudas, vuelven solos a las {new Date(pausedUntil).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={demoBusy !== null}
            onClick={() => runDemo({ action: 'resume' }, 'Consumidores reanudados')}
          >
            <Play className="w-4 h-4 mr-1.5" /> Reanudar
          </Button>
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
        {subscriptions.map((sub) => {
          const stats = state.worker?.stats?.[sub.name]
          return (
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
            {stats && (
              <p className="text-xs text-muted-foreground">
                Procesados <span className="font-semibold text-foreground">{stats.processed}</span> · Reintentos{' '}
                <span className="font-semibold text-foreground">{stats.retried}</span> · A la cola de errores{' '}
                <span className="font-semibold text-foreground">{stats.deadLettered}</span>
              </p>
            )}
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
          )
        })}
      </div>

      {/* Modo demostración */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-card-foreground flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              Demostración
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Eventos de prueba que recorren el mismo camino que los reales, sin tocar documentos ni incidentes. El
              resultado se ve en los contadores, en la cola de errores y en la campana.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={demoBusy !== null}
            onClick={() =>
              pausedUntil
                ? runDemo({ action: 'resume' }, 'Consumidores reanudados')
                : runDemo({ action: 'pause' }, 'Consumidores en pausa: lo que publiques quedará esperando en el broker')
            }
          >
            {demoBusy === 'pause' || demoBusy === 'resume' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : pausedUntil ? (
              <Play className="w-4 h-4 mr-2" />
            ) : (
              <Pause className="w-4 h-4 mr-2" />
            )}
            {pausedUntil ? 'Reanudar consumidores' : 'Pausar consumidores (durabilidad)'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DEMO_ACTIONS.map((demo) => (
            <button
              key={demo.scenario}
              type="button"
              disabled={demoBusy !== null}
              onClick={() => runDemo({ action: 'demo', scenario: demo.scenario }, `Evento publicado: ${demo.label.toLowerCase()}`)}
              className="text-left rounded-lg border border-border bg-muted/30 hover:bg-muted/60 p-3 transition-colors disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{demo.label}</span>
                {demoBusy === demo.scenario ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <p className="text-[11px] font-mono text-primary mt-1">{demo.concepts}</p>
              <p className="text-xs text-muted-foreground mt-1">{demo.detail}</p>
            </button>
          ))}
        </div>
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
