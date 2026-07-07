'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Building2, ChevronRight, Table2, KanbanSquare, DollarSign,
  Users, TrendingUp, AlertTriangle, Clock, MessageCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  STAGE_ORDER, STAGE_CONFIG, healthColor, formatClp, whatsappLink,
  type CompanyStage,
} from '@/lib/crm-ui'

interface Health {
  score: number
  label: string
}
interface CrmCompany {
  id: string
  name: string
  rut: string | null
  phone: string | null
  stage: CompanyStage
  createdAt: string
  plan: string
  users: number
  documents: number
  health: Health
}
interface Kpis {
  totalCompanies: number
  paidCompanies: number
  freeCompanies: number
  estimatedMrr: number
  totalUsers: number
  totalDocuments: number
  expiringSoon: number
  atRisk: number
}

function HealthPill({ health }: { health: Health }) {
  const c = healthColor(health.score)
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${health.score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${c.text}`}>{health.score}</span>
    </div>
  )
}

function StageChip({ stage }: { stage: CompanyStage }) {
  const s = STAGE_CONFIG[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-black ${accent ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}

export default function CRMPage() {
  const [companies, setCompanies] = useState<CrmCompany[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'pipeline'>('table')
  const [dragId, setDragId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/overview')
      const json = await res.json()
      if (json.data) {
        setCompanies(json.data.companies)
        setKpis(json.data.kpis)
      }
    } catch (error) {
      console.error('Error loading CRM overview', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function moveToStage(companyId: string, stage: CompanyStage) {
    const prev = companies
    // Optimista
    setCompanies((cs) => cs.map((c) => (c.id === companyId ? { ...c, stage } : c)))
    try {
      const res = await fetch(`/api/admin/crm/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Etapa actualizada', description: `Movida a "${STAGE_CONFIG[stage].label}"` })
    } catch {
      setCompanies(prev) // revertir
      toast({ title: 'Error', description: 'No se pudo mover la empresa', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Empresas (CRM)</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Centro de Control CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas cliente, ingresos y salud de cada cuenta.
          </p>
        </div>
        {/* Toggle de vista */}
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30 self-start">
          <button
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Table2 className="w-4 h-4" /> Tabla
          </button>
          <button
            onClick={() => setView('pipeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'pipeline' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <KanbanSquare className="w-4 h-4" /> Pipeline
          </button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={<DollarSign className="w-4 h-4" />} label="MRR estimado" value={formatClp(kpis.estimatedMrr)} accent="text-primary" />
          <KpiCard icon={<Building2 className="w-4 h-4" />} label="Empresas" value={String(kpis.totalCompanies)} />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="De pago" value={String(kpis.paidCompanies)} accent="text-emerald-600 dark:text-emerald-400" />
          <KpiCard icon={<Users className="w-4 h-4" />} label="Usuarios" value={String(kpis.totalUsers)} />
          <KpiCard icon={<Clock className="w-4 h-4" />} label="Vencen pronto" value={String(kpis.expiringSoon)} accent={kpis.expiringSoon > 0 ? 'text-amber-600 dark:text-amber-400' : undefined} />
          <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="En riesgo" value={String(kpis.atRisk)} accent={kpis.atRisk > 0 ? 'text-rose-600 dark:text-rose-400' : undefined} />
        </div>
      )}

      {/* Vista Tabla */}
      {view === 'table' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etapa</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Salud</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Usuarios</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Docs</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, i) => {
                  const wa = whatsappLink(company.phone)
                  return (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-card-foreground text-sm">{company.name}</div>
                        <div className="text-xs text-muted-foreground">{company.rut || 'Sin RUT'}</div>
                      </td>
                      <td className="py-3 px-4"><StageChip stage={company.stage} /></td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold ${company.plan === 'FREE' ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {company.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4"><HealthPill health={company.health} /></td>
                      <td className="py-3 px-4 text-center text-sm font-semibold hidden md:table-cell">{company.users}</td>
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground hidden md:table-cell">{company.documents}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {wa && (
                            <a
                              href={wa} target="_blank" rel="noopener noreferrer"
                              title="Contactar por WhatsApp"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <Button variant="ghost" size="sm" asChild className="text-primary">
                            <Link href={`/admin/crm/${company.id}`}>
                              Detalles <ChevronRight className="w-4 h-4 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            {companies.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No hay empresas registradas.</div>
            )}
          </div>
        </div>
      )}

      {/* Vista Pipeline (Kanban) */}
      {view === 'pipeline' && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STAGE_ORDER.map((stage) => {
            const items = companies.filter((c) => c.stage === stage)
            const meta = STAGE_CONFIG[stage]
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) { moveToStage(dragId, stage); setDragId(null) } }}
                className="flex-shrink-0 w-64 rounded-xl border border-border bg-muted/20 p-3 space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">{items.length}</span>
                </div>

                <div className="space-y-2 min-h-[60px]">
                  {items.map((c) => {
                    const hc = healthColor(c.health.score)
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`group rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all ${dragId === c.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/admin/crm/${c.id}`} className="font-medium text-sm text-card-foreground hover:text-primary line-clamp-1">
                            {c.name}
                          </Link>
                          <span className={`text-xs font-bold ${hc.text}`}>{c.health.score}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span className={`font-semibold ${c.plan === 'FREE' ? '' : 'text-emerald-600 dark:text-emerald-400'}`}>{c.plan}</span>
                          <span>·</span>
                          <span>{c.users} usr</span>
                          <span>·</span>
                          <span>{c.documents} docs</span>
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                      Arrastra aquí
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
