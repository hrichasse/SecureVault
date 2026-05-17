'use client'

import { useState } from 'react'
import { PLAN_CONFIG, type PlanConfig } from '@/modules/subscriptions/subscriptions.service'
import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client'
import {
  CheckCircle2, XCircle, AlertCircle, Crown, Zap, Building2,
  Users, FileText, ShieldCheck, BarChart3, Headphones, ArrowRight, Loader2
} from 'lucide-react'

interface Props {
  companyId: string
  companyName?: string
  currentPlan: SubscriptionPlan
  planConfig: PlanConfig
  subscription: {
    status: SubscriptionStatus
    expiresAt: string | null
    maxUsers: number
    maxDocuments: number
  } | null
  usage: { users: number; documents: number }
  notification: {
    type: 'success' | 'cancelled' | 'error'
    plan?: string
    amount?: string
    code?: string
  } | null
}

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  FREE: <Zap className="w-5 h-5" />,
  PRO: <Crown className="w-5 h-5" />,
  ENTERPRISE: <Building2 className="w-5 h-5" />,
}

const PLAN_COLORS: Record<SubscriptionPlan, { bg: string; border: string; text: string; badge: string }> = {
  FREE: {
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
  },
  PRO: {
    bg: 'bg-primary/5',
    border: 'border-primary/30',
    text: 'text-primary',
    badge: 'bg-primary/15 text-primary',
  },
  ENTERPRISE: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
}

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const isUnlimited = max === -1
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100)
  const isWarning = !isUnlimited && pct >= 80
  const isDanger = !isUnlimited && pct >= 95

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isDanger ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground'}`}>
          {current} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        {!isUnlimited && (
          <div
            className={`h-full rounded-full transition-all ${isDanger ? 'bg-destructive' : isWarning ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        )}
        {isUnlimited && <div className="h-full w-full bg-primary/30 rounded-full" />}
      </div>
    </div>
  )
}

export function SubscriptionClient({
  companyId,
  currentPlan,
  planConfig,
  subscription,
  usage,
  notification,
}: Props) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleUpgrade(plan: SubscriptionPlan) {
    if (plan === 'ENTERPRISE') {
      window.open('mailto:ventas@securevault.cl?subject=Consulta%20Plan%20Enterprise', '_blank')
      return
    }

    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/payments/transbank/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, companyId }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        alert(data.error || 'Error al procesar el pago')
        setLoadingPlan(null)
        return
      }

      // Redirigir a Transbank (formulario POST requerido)
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.url
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'token_ws'
      input.value = data.token
      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
    } catch {
      alert('Error de conexión. Por favor intenta de nuevo.')
      setLoadingPlan(null)
    }
  }

  const expiresAt = subscription?.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const colors = PLAN_COLORS[currentPlan]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Suscripción</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona el plan de tu organización en SecureVault</p>
      </div>

      {/* Notification banners */}
      {notification?.type === 'success' && (
        <div className="flex items-start gap-3 bg-success/10 border border-success/30 text-success rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">¡Pago exitoso! Tu plan ha sido actualizado.</p>
            {notification.plan && (
              <p className="text-sm mt-0.5 text-success/80">
                Ahora estás en el plan <strong>{PLAN_CONFIG[notification.plan as SubscriptionPlan]?.label}</strong>
                {notification.amount && ` · Monto: $${Number(notification.amount).toLocaleString('es-CL')} CLP`}
              </p>
            )}
          </div>
        </div>
      )}
      {notification?.type === 'cancelled' && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 text-warning rounded-xl p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Pago cancelado. No se realizó ningún cargo.</p>
        </div>
      )}
      {notification?.type === 'error' && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            El pago no pudo procesarse. Por favor intenta de nuevo o contacta soporte.
            {notification.code && ` (Código: ${notification.code})`}
          </p>
        </div>
      )}

      {/* Plan actual */}
      <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-6 space-y-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan actual</p>
            <div className="flex items-center gap-2.5">
              <span className={`${colors.text}`}>{PLAN_ICONS[currentPlan]}</span>
              <h2 className={`text-2xl font-bold ${colors.text}`}>{planConfig.label}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {subscription?.status === 'ACTIVE' ? 'Activo' : subscription?.status ?? 'Activo'}
              </span>
            </div>
            {currentPlan !== 'FREE' && (
              <p className="text-sm text-muted-foreground">
                {planConfig.price > 0 ? `$${planConfig.price.toLocaleString('es-CL')} CLP/mes` : 'Precio personalizado'}
                {expiresAt && ` · Vence el ${expiresAt}`}
              </p>
            )}
          </div>
          {currentPlan === 'FREE' && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">¿Necesitas más?</p>
              <p className="text-sm font-semibold text-primary">Actualiza tu plan ↓</p>
            </div>
          )}
        </div>

        {/* Uso actual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
          <UsageBar
            current={usage.users}
            max={subscription?.maxUsers ?? planConfig.maxUsers}
            label="Usuarios"
          />
          <UsageBar
            current={usage.documents}
            max={subscription?.maxDocuments ?? planConfig.maxDocuments}
            label="Documentos"
          />
        </div>
      </div>

      {/* Tabla comparativa de planes */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Comparar planes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(PLAN_CONFIG) as SubscriptionPlan[]).map((plan) => {
            const config = PLAN_CONFIG[plan]
            const isCurrent = plan === currentPlan
            const pc = PLAN_COLORS[plan]

            return (
              <div
                key={plan}
                className={`rounded-xl border-2 p-5 space-y-5 flex flex-col transition-all
                  ${isCurrent
                    ? `${pc.border} ${pc.bg} shadow-lg`
                    : 'border-border bg-card hover:border-primary/30 hover:shadow-md'
                  }`}
              >
                {/* Plan header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 ${isCurrent ? pc.text : 'text-foreground'}`}>
                      {PLAN_ICONS[plan]}
                      <span className="font-bold text-lg">{config.label}</span>
                    </div>
                    {isCurrent && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pc.badge}`}>
                        Actual
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    {config.price === 0 && plan === 'FREE' ? (
                      <span className="text-2xl font-black text-foreground">Gratis</span>
                    ) : config.price === 0 ? (
                      <span className="text-2xl font-black text-foreground">Contactar</span>
                    ) : (
                      <>
                        <span className="text-2xl font-black text-foreground">
                          ${config.price.toLocaleString('es-CL')}
                        </span>
                        <span className="text-sm text-muted-foreground">CLP/mes</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1">
                  {config.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isCurrent ? pc.text : 'text-success'}`} />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {isCurrent ? (
                  <div className={`text-center text-sm font-medium py-2.5 rounded-lg ${pc.badge}`}>
                    Plan actual
                  </div>
                ) : plan === 'FREE' ? (
                  <div className="text-center text-sm text-muted-foreground py-2.5 rounded-lg bg-muted/50">
                    Plan base
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none
                      ${plan === 'PRO'
                        ? 'gradient-primary text-primary-foreground hover:opacity-90'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                  >
                    {loadingPlan === plan ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                    ) : plan === 'ENTERPRISE' ? (
                      <><Headphones className="w-4 h-4" /> Contactar ventas</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Actualizar a {config.label}</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info Transbank */}
      {currentPlan === 'FREE' && (
        <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-4 text-sm text-muted-foreground">
          <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0 text-success" />
          <div>
            <p className="font-medium text-foreground">Pago 100% seguro con Transbank Webpay</p>
            <p className="mt-0.5">
              Los pagos son procesados directamente por Transbank, el operador de pagos electrónicos más grande de Chile.
              Aceptamos todas las tarjetas de crédito y débito chilenas.
            </p>
          </div>
        </div>
      )}

      {/* Métricas adicionales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-5 h-5 text-primary" />, label: 'Usuarios activos', value: usage.users },
          { icon: <FileText className="w-5 h-5 text-secondary" />, label: 'Documentos', value: usage.documents },
          {
            icon: <BarChart3 className="w-5 h-5 text-warning" />,
            label: 'Límite usuarios',
            value: planConfig.maxUsers === -1 ? '∞' : planConfig.maxUsers,
          },
          {
            icon: <ShieldCheck className="w-5 h-5 text-success" />,
            label: 'Límite documentos',
            value: planConfig.maxDocuments === -1 ? '∞' : planConfig.maxDocuments,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              {stat.icon}
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
            <p className="text-2xl font-black text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
