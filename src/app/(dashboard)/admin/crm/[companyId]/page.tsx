'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Building2, ArrowLeft, Mail, MapPin, Briefcase, Trash2, Phone,
  MessageCircle, Save, X, Pencil, StickyNote, Send, Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import {
  STAGE_ORDER, STAGE_CONFIG, healthColor, whatsappLink, type CompanyStage,
} from '@/lib/crm-ui'

interface CRMUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count: { documents: number }
}
interface Health { score: number; label: string; breakdown: { activity: number; usage: number; plan: number; incidentPenalty: number } }
interface CompanyDetails {
  id: string
  name: string
  rut: string | null
  email: string
  phone: string | null
  address: string | null
  businessLine: string | null
  adminName: string | null
  stage: CompanyStage
  createdAt: string
  subscription: { plan: string; status: string } | null
  users: CRMUser[]
  documentsCount: number
  health: Health
}
interface Note { id: string; authorName: string; body: string; createdAt: string }

function HealthRing({ score }: { score: number }) {
  const c = healthColor(score)
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative w-[68px] h-[68px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} className="stroke-muted" strokeWidth="6" fill="none" />
        <circle cx="34" cy="34" r={r} className={`${c.ring} transition-all`} stroke="currentColor" strokeWidth="6" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-lg font-black ${c.text}`}>{score}</span>
    </div>
  )
}

export default function CompanyDetailPage({ params }: { params: { companyId: string } }) {
  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [savingStage, setSavingStage] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const loadCompany = useCallback(async () => {
    try {
      const [cRes, nRes] = await Promise.all([
        fetch(`/api/admin/crm/companies/${params.companyId}`),
        fetch(`/api/admin/crm/companies/${params.companyId}/notes`),
      ])
      const cJson = await cRes.json()
      if (cJson.data) {
        setCompany(cJson.data)
        setPhoneInput(cJson.data.phone ?? '')
      } else {
        toast({ title: 'Error', description: 'Empresa no encontrada', variant: 'destructive' })
        router.push('/admin/crm')
        return
      }
      const nJson = await nRes.json()
      if (nJson.data) setNotes(nJson.data)
    } catch (error) {
      console.error('Error loading company details', error)
    } finally {
      setLoading(false)
    }
  }, [params.companyId, router, toast])

  useEffect(() => { loadCompany() }, [loadCompany])

  async function patchCompany(payload: { stage?: CompanyStage; phone?: string | null }) {
    const res = await fetch(`/api/admin/crm/companies/${params.companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error()
    return res.json()
  }

  async function handleStageChange(stage: CompanyStage) {
    if (!company || stage === company.stage) return
    setSavingStage(true)
    const prev = company.stage
    setCompany({ ...company, stage })
    try {
      await patchCompany({ stage })
      toast({ title: 'Etapa actualizada', description: `Ahora está en "${STAGE_CONFIG[stage].label}"` })
    } catch {
      setCompany({ ...company, stage: prev })
      toast({ title: 'Error', description: 'No se pudo actualizar la etapa', variant: 'destructive' })
    } finally {
      setSavingStage(false)
    }
  }

  async function handleSavePhone() {
    if (!company) return
    try {
      await patchCompany({ phone: phoneInput })
      setCompany({ ...company, phone: phoneInput.trim() || null })
      setEditingPhone(false)
      toast({ title: 'Teléfono guardado' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el teléfono', variant: 'destructive' })
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/admin/crm/companies/${params.companyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      setNotes((n) => [json.data, ...n])
      setNoteBody('')
    } catch {
      toast({ title: 'Error', description: 'No se pudo agregar la nota', variant: 'destructive' })
    } finally {
      setAddingNote(false)
    }
  }

  async function handleDeleteUser(u: CRMUser) {
    if (!confirm(`¿Eliminar al usuario ${u.name} (${u.email})? Se borrará de la base de datos y de la autenticación. Esta acción no se puede deshacer.`)) return
    setDeletingUserId(u.id)
    try {
      const res = await fetch(`/api/admin/users?userId=${u.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        // 409 = bloqueado por contenido propio; se muestra el motivo
        toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
        return
      }
      setCompany((c) => (c ? { ...c, users: c.users.filter((x) => x.id !== u.id) } : c))
      toast({ title: 'Usuario eliminado', description: `${u.name} fue eliminado del sistema.` })
    } catch {
      toast({ title: 'Error', description: 'Ocurrió un error al eliminar el usuario', variant: 'destructive' })
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la empresa ${company?.name}? Esto eliminará todos sus usuarios y documentos.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/crm/companies/${params.companyId}`, { method: 'DELETE' })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'Empresa eliminada', description: 'La empresa ha sido eliminada del sistema.' })
        router.push('/admin/crm')
      } else {
        toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Ocurrió un error inesperado al eliminar', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/4 bg-muted animate-pulse rounded" />
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }
  if (!company) return null

  const wa = whatsappLink(company.phone, `Hola ${company.name}, te contactamos desde SecureVault.`)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link href="/admin/crm" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Empresas
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> {company.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">RUT: {company.rut || 'No registrado'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-2 text-sm font-medium hover:bg-emerald-500/20 transition-colors">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          <StatusBadge variant={company.subscription?.plan === 'PRO' || company.subscription?.plan === 'ENTERPRISE' ? 'success' : 'neutral'}>
            Plan {company.subscription?.plan || 'FREE'}
          </StatusBadge>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-2" /> {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </div>

      {/* Health + Etapa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 flex items-center gap-4">
          <HealthRing score={company.health.score} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Salud de la cuenta</p>
            <p className={`text-lg font-bold ${healthColor(company.health.score).text}`}>{company.health.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Actividad {company.health.breakdown.activity} · Uso {company.health.breakdown.usage} · Plan {company.health.breakdown.plan}
              {company.health.breakdown.incidentPenalty !== 0 && ` · Incidentes ${company.health.breakdown.incidentPenalty}`}
            </p>
          </div>
        </div>

        <div className="card p-5 md:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Etapa en el pipeline</p>
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.map((s) => {
              const meta = STAGE_CONFIG[s]
              const active = company.stage === s
              return (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={savingStage}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-60 ${active ? meta.chip + ' ring-2 ring-offset-1 ring-offset-background' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="card p-5 space-y-4 md:col-span-1 h-fit">
          <h3 className="font-semibold text-card-foreground border-b border-border pb-2">Datos de Contacto</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Email principal</p>
                <p className="font-medium">{company.email}</p>
              </div>
            </div>

            {/* Teléfono editable */}
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-muted-foreground text-xs">Teléfono (WhatsApp)</p>
                {editingPhone ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+56912345678"
                      className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button onClick={handleSavePhone} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-500/10"><Save className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingPhone(false); setPhoneInput(company.phone ?? '') }} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{company.phone || 'No registrado'}</p>
                    <button onClick={() => setEditingPhone(true)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Dirección</p>
                <p className="font-medium">{company.address || 'No registrada'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Giro comercial</p>
                <p className="font-medium">{company.businessLine || 'No registrado'}</p>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Registrada el</p>
              <p className="font-medium">{new Date(company.createdAt).toLocaleDateString('es-CL')}</p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card md:col-span-2 overflow-hidden h-fit">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold text-card-foreground">Usuarios de la Empresa ({company.users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rol</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docs Subidos</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {company.users.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={u.role === 'ADMIN_COMPANY' ? 'warning' : u.role === 'NOTARY' ? 'success' : 'neutral'}>{u.role}</StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-center"><span className="text-sm">{u._count.documents}</span></td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={deletingUserId === u.id}
                        title="Eliminar usuario"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {deletingUserId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notas / Timeline */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-card-foreground flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" /> Notas y seguimiento ({notes.length})
        </h3>
        <div className="flex items-start gap-2">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Agrega una nota de seguimiento (llamada, acuerdo, recordatorio)..."
            rows={2}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button onClick={handleAddNote} disabled={addingNote || !noteBody.trim()} className="shrink-0">
            <Send className="w-4 h-4 mr-1.5" /> {addingNote ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>

        <div className="space-y-3">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aún no hay notas. Registra la primera interacción.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="flex gap-3 border-l-2 border-primary/30 pl-3 py-1">
              <div className="flex-1">
                <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {n.authorName} · {new Date(n.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
