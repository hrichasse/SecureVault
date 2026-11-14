'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Building2, Gauge, Layers, Loader2, Radio, Terminal } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StatCard } from '@/components/ui/stat-card'
import { ConfidentialityBadge } from '@/components/documents/ConfidentialityBadge'
import { EVENT_LABELS } from '@/lib/streaming/labels'
import type { FeedSnapshot } from '@/lib/streaming/live-feed'

type View =
  | { kind: 'connecting' }
  | { kind: 'disabled' }
  | { kind: 'lost' }
  | { kind: 'live'; snap: FeedSnapshot }

const PRIMARY = 'hsl(var(--primary))'
const GRID = 'hsl(var(--border))'
const MUTED = 'hsl(var(--muted-foreground))'
const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--card-foreground))',
}

const ALERT_LABEL = { EXFILTRACION: 'Posible fuga de información', INCIDENTE_CRITICO: 'Incidente crítico' } as const

export function StreamingClient() {
  const [view, setView] = useState<View>({ kind: 'connecting' })
  const lastSnap = useRef<FeedSnapshot | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/admin/streaming')
    source.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.enabled === false) {
        setView({ kind: 'disabled' })
        source.close()
        return
      }
      lastSnap.current = data as FeedSnapshot
      setView({ kind: 'live', snap: data as FeedSnapshot })
    }
    // EventSource reintenta solo; mientras tanto se avisa que la conexión se cortó
    source.onerror = () => {
      if (source.readyState !== EventSource.CLOSED) setView((v) => (v.kind === 'live' ? { kind: 'lost' } : v))
    }
    return () => source.close()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" /> Streaming de eventos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Flujo continuo de eventos de negocio en Apache Kafka y métricas en tiempo real (últimos 60 segundos).
          </p>
        </div>
        <LiveBadge view={view} />
      </div>

      {view.kind === 'connecting' && (
        <div className="card p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Conectando con Kafka…
        </div>
      )}

      {view.kind === 'disabled' && <SetupHelp />}

      {view.kind === 'lost' && lastSnap.current && <Dashboard snap={lastSnap.current} stale />}
      {view.kind === 'live' && view.snap.status === 'error' && (
        <div className="card p-6 border-destructive/30 text-sm">
          <p className="font-semibold text-destructive">No se pudo conectar con Kafka</p>
          <p className="text-muted-foreground mt-1">{view.snap.error}</p>
          <p className="text-muted-foreground mt-2">
            Revisa que el broker esté arriba (<code>npm run kafka:up</code>). El panel reintenta solo.
          </p>
        </div>
      )}
      {view.kind === 'live' && view.snap.status !== 'error' && <Dashboard snap={view.snap} />}
    </div>
  )
}

function LiveBadge({ view }: { view: View }) {
  const live = view.kind === 'live' && view.snap.status === 'connected'
  const label =
    view.kind === 'disabled'
      ? 'Kafka no configurado'
      : view.kind === 'lost'
        ? 'Reconectando…'
        : live
          ? 'En vivo'
          : 'Conectando…'
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
      <span className="relative flex h-2.5 w-2.5">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
      </span>
      {label}
    </span>
  )
}

function SetupHelp() {
  return (
    <div className="card p-6 space-y-3 text-sm">
      <p className="font-semibold text-foreground flex items-center gap-2">
        <Terminal className="h-4 w-4" /> El streaming funciona en local con Docker
      </p>
      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
        <li>
          Levanta Kafka: <code className="text-foreground">npm run kafka:up</code> (Kafka UI en http://localhost:8080)
        </li>
        <li>
          Agrega <code className="text-foreground">KAFKA_BROKERS=localhost:9092</code> a <code>.env.local</code> y reinicia{' '}
          <code className="text-foreground">npm run dev</code>
        </li>
        <li>
          Publica eventos: <code className="text-foreground">npm run kafka:producer</code> (simulador) y/o{' '}
          <code className="text-foreground">npm run kafka:relay</code> (acciones reales de la app)
        </li>
      </ol>
      <p className="text-muted-foreground">Detalle en docs/streaming.md.</p>
    </div>
  )
}

function Dashboard({ snap, stale = false }: { snap: FeedSnapshot; stale?: boolean }) {
  const m = snap.metrics
  const levelMax = Math.max(1, ...Object.values(m.byLevel))
  const companyMax = Math.max(1, ...m.topCompanies.map((c) => c.count))
  const byType = m.byType.slice(0, 8)

  return (
    <div className={`space-y-6 ${stale ? 'opacity-60' : ''}`}>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Eventos por segundo" value={m.eventsPerSecond.toFixed(1)} subtitle="promedio últimos 10 s" icon={Gauge} />
        <StatCard title="Últimos 60 s" value={m.windowCount} subtitle={`app ${m.bySource.app} · simulador ${m.bySource.simulator}`} icon={Activity} />
        <StatCard title="Recibidos" value={m.totalReceived} subtitle="desde que se abrió el panel" icon={Layers} />
        <StatCard title="Alertas" value={m.alerts.length} subtitle="detectadas en el flujo" icon={AlertTriangle} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground">Eventos por segundo</h2>
        <p className="text-xs text-muted-foreground mb-3">Últimos {m.windowSeconds} segundos · se actualiza cada segundo</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="second" tick={{ fontSize: 11, fill: MUTED }} interval={14} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
                formatter={(value) => [value, 'eventos']}
                labelFormatter={(label) => `Segundo ${label}`}
              />
              <Area type="monotone" dataKey="count" stroke={PRIMARY} strokeWidth={2} fill={PRIMARY} fillOpacity={0.15} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Por tipo de evento</h2>
          {byType.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ height: Math.max(120, byType.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(value) => [value, 'eventos']} />
                  <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} label={{ position: 'right', fontSize: 11, fill: MUTED }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Documentos por nivel de confidencialidad</h2>
            <div className="space-y-2">
              {(Object.entries(m.byLevel) as [keyof typeof m.byLevel, number][]).map(([level, count]) => (
                <div key={level} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <ConfidentialityBadge level={level} size="sm" />
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / levelMax) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Empresas más activas
            </h2>
            {m.topCompanies.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-2">
                {m.topCompanies.map((c) => (
                  <div key={c.companyId} className="flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0 truncate text-foreground">{c.companyName}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(c.count / companyMax) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-foreground">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas detectadas en el flujo
        </h2>
        {m.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas. Se detectan descargas masivas de documentos sensibles e incidentes críticos.</p>
        ) : (
          <ul className="space-y-2">
            {m.alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {ALERT_LABEL[a.kind]} · <span className="text-muted-foreground font-normal">{a.companyName}</span>
                  </p>
                  <p className="text-muted-foreground">{a.message}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{a.detectedAt.slice(11, 19)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2 className="text-sm font-semibold text-foreground">Eventos en vivo</h2>
          <p className="text-xs text-muted-foreground">
            topic <code>{snap.topic}</code> · grupo <code>{snap.groupId}</code> · offsets{' '}
            {Object.entries(snap.offsets)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([p, o]) => `p${p}=${o}`)
              .join('  ') || '—'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Hora</th>
                <th className="px-3 py-2 font-medium">Evento</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Documento</th>
                <th className="px-5 py-2 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {m.recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-muted-foreground">
                    Esperando eventos… ejecuta <code>npm run kafka:producer</code>
                  </td>
                </tr>
              )}
              {m.recent.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2 tabular-nums text-muted-foreground">{e.occurredAt.slice(11, 19)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{EVENT_LABELS[e.type]}</td>
                  <td className="px-3 py-2">{e.confidentialityLevel ? <ConfidentialityBadge level={e.confidentialityLevel} size="sm" /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{e.companyName}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{e.userName ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.documentName ?? '—'}</td>
                  <td className="px-5 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.source === 'app' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {e.source === 'app' ? 'App' : 'Simulador'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Sin eventos en el último minuto.</p>
}
