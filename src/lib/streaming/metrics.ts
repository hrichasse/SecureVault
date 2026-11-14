/**
 * metrics.ts — Métricas en tiempo real sobre el flujo de eventos de negocio.
 *
 * Ventana deslizante (por defecto 60 s) en memoria: cada evento que llega del
 * topic se agrega, y en cualquier momento se puede pedir una "foto" con:
 *   - eventos por segundo y serie de los últimos 60 s
 *   - conteo por tipo de evento, por nivel de confidencialidad y por empresa
 *   - alertas de seguridad detectadas sobre el flujo
 *
 * Reglas de alerta (procesamiento de flujo, no consultas a la BD):
 *   EXFILTRACION       un mismo usuario ve/descarga ≥ 6 documentos ALTO o CRÍTICO
 *                      en 5 s → posible fuga de información (en 60 s no sirve:
 *                      el uso normal ya llega a 5 por minuto)
 *   INCIDENTE_CRITICO  se reporta un incidente de prioridad CRÍTICA
 *
 * Lógica pura (sin Kafka): la usan el consumidor de terminal, el panel web y los tests.
 */
import { EVENT_LABELS, type BusinessEvent, type BusinessEventType, type ConfidentialityLevel } from './events'

export type AlertKind = 'EXFILTRACION' | 'INCIDENTE_CRITICO'

export interface StreamAlert {
  id: string
  kind: AlertKind
  message: string
  detectedAt: string
  companyName: string
  userName?: string
}

export interface MetricsSnapshot {
  generatedAt: string
  windowSeconds: number
  /** Eventos recibidos desde que arrancó el consumidor */
  totalReceived: number
  /** Eventos dentro de la ventana */
  windowCount: number
  /** Promedio de los últimos 10 segundos */
  eventsPerSecond: number
  /** Eventos por segundo, del más antiguo al más reciente (windowSeconds puntos; t = epoch ms) */
  series: { t: number; count: number }[]
  byType: { type: BusinessEventType; label: string; count: number }[]
  byLevel: Record<ConfidentialityLevel, number>
  topCompanies: { companyId: string; companyName: string; count: number }[]
  bySource: { app: number; simulator: number }
  alerts: StreamAlert[]
  recent: BusinessEvent[]
}

interface Entry {
  receivedAt: number
  event: BusinessEvent
}

export interface MetricsOptions {
  windowSeconds?: number
  /** Vistas de documentos ALTO/CRÍTICO de un mismo usuario que disparan EXFILTRACION */
  exfiltrationThreshold?: number
  /** ...dentro de esta cantidad de segundos */
  exfiltrationWindowSeconds?: number
  maxRecent?: number
  maxAlerts?: number
}

const SENSITIVE: ConfidentialityLevel[] = ['ALTO', 'CRITICO']

export class MetricsWindow {
  readonly windowSeconds: number
  private readonly windowMs: number
  private readonly exfiltrationThreshold: number
  readonly exfiltrationWindowSeconds: number
  private readonly maxRecent: number
  private readonly maxAlerts: number

  private entries: Entry[] = []
  private recent: BusinessEvent[] = []
  private alerts: StreamAlert[] = []
  private totalReceived = 0
  /** Última alerta de exfiltración por usuario (para no repetirla en cada evento) */
  private lastExfiltrationAlert = new Map<string, number>()

  constructor(options: MetricsOptions = {}) {
    this.windowSeconds = options.windowSeconds ?? 60
    this.windowMs = this.windowSeconds * 1000
    this.exfiltrationThreshold = options.exfiltrationThreshold ?? 6
    this.exfiltrationWindowSeconds = Math.min(options.exfiltrationWindowSeconds ?? 5, this.windowSeconds)
    this.maxRecent = options.maxRecent ?? 15
    this.maxAlerts = options.maxAlerts ?? 10
  }

  /** Agrega un evento y devuelve las alertas nuevas que provocó. */
  add(event: BusinessEvent, now = Date.now()): StreamAlert[] {
    this.prune(now)
    this.entries.push({ receivedAt: now, event })
    this.totalReceived++
    this.recent.unshift(event)
    if (this.recent.length > this.maxRecent) this.recent.pop()

    const raised = this.detect(event, now)
    if (raised.length > 0) {
      this.alerts.unshift(...raised)
      this.alerts.length = Math.min(this.alerts.length, this.maxAlerts)
    }
    return raised
  }

  snapshot(now = Date.now()): MetricsSnapshot {
    this.prune(now)

    const nowSecond = Math.floor(now / 1000)
    const firstSecond = nowSecond - this.windowSeconds + 1
    const perSecond = new Array<number>(this.windowSeconds).fill(0)
    const byType = new Map<BusinessEventType, number>()
    const byLevel: Record<ConfidentialityLevel, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 }
    const byCompany = new Map<string, { companyName: string; count: number }>()
    const bySource = { app: 0, simulator: 0 }

    for (const { receivedAt, event } of this.entries) {
      const idx = Math.floor(receivedAt / 1000) - firstSecond
      if (idx >= 0 && idx < perSecond.length) perSecond[idx]++
      byType.set(event.type, (byType.get(event.type) ?? 0) + 1)
      if (event.confidentialityLevel) byLevel[event.confidentialityLevel]++
      const company = byCompany.get(event.companyId) ?? { companyName: event.companyName ?? event.companyId, count: 0 }
      company.count++
      byCompany.set(event.companyId, company)
      bySource[event.source]++
    }

    const last10 = perSecond.slice(-10)
    return {
      generatedAt: new Date(now).toISOString(),
      windowSeconds: this.windowSeconds,
      totalReceived: this.totalReceived,
      windowCount: this.entries.length,
      eventsPerSecond: Math.round((last10.reduce((a, b) => a + b, 0) / last10.length) * 10) / 10,
      series: perSecond.map((count, i) => ({ t: (firstSecond + i) * 1000, count })),
      byType: Array.from(byType.entries())
        .map(([type, count]) => ({ type, label: EVENT_LABELS[type], count }))
        .sort((a, b) => b.count - a.count),
      byLevel,
      topCompanies: Array.from(byCompany.entries())
        .map(([companyId, c]) => ({ companyId, ...c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      bySource,
      alerts: [...this.alerts],
      recent: [...this.recent],
    }
  }

  private prune(now: number) {
    const limit = now - this.windowMs
    let i = 0
    while (i < this.entries.length && this.entries[i].receivedAt <= limit) i++
    if (i > 0) this.entries.splice(0, i)
  }

  private detect(event: BusinessEvent, now: number): StreamAlert[] {
    const raised: StreamAlert[] = []
    const companyName = event.companyName ?? event.companyId

    if (event.type === 'CREATE_INCIDENT' && event.priority === 'CRITICAL') {
      raised.push({
        id: `inc-${event.id}`,
        kind: 'INCIDENTE_CRITICO',
        message: `Incidente CRÍTICO reportado${event.documentName ? ` sobre "${event.documentName}"` : ''}`,
        detectedAt: new Date(now).toISOString(),
        companyName,
        userName: event.userName,
      })
    }

    if (
      event.type === 'VIEW_DOCUMENT' &&
      event.userId &&
      event.confidentialityLevel &&
      SENSITIVE.includes(event.confidentialityLevel)
    ) {
      const since = now - this.exfiltrationWindowSeconds * 1000
      const views = this.entries.filter(
        (e) =>
          e.receivedAt > since &&
          e.event.type === 'VIEW_DOCUMENT' &&
          e.event.userId === event.userId &&
          e.event.confidentialityLevel != null &&
          SENSITIVE.includes(e.event.confidentialityLevel)
      ).length
      const last = this.lastExfiltrationAlert.get(event.userId)
      if (views >= this.exfiltrationThreshold && (last === undefined || now - last > this.windowMs)) {
        this.lastExfiltrationAlert.set(event.userId, now)
        raised.push({
          id: `exf-${event.userId}-${now}`,
          kind: 'EXFILTRACION',
          message: `${event.userName ?? 'Un usuario'} vio ${views} documentos ALTO/CRÍTICO en menos de ${this.exfiltrationWindowSeconds} s: posible fuga de información`,
          detectedAt: new Date(now).toISOString(),
          companyName,
          userName: event.userName,
        })
      }
    }

    return raised
  }
}
