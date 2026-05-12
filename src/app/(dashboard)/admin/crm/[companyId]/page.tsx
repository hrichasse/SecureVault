'use client'

import { useEffect, useState } from 'react'
import { Building2, ArrowLeft, Mail, MapPin, Briefcase, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface CRMUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count: {
    documents: number
  }
}

interface CompanyDetails {
  id: string
  name: string
  rut: string | null
  email: string
  address: string | null
  businessLine: string | null
  adminName: string | null
  createdAt: string
  subscription: {
    plan: string
    status: string
  } | null
  users: CRMUser[]
}

export default function CompanyDetailPage({ params }: { params: { companyId: string } }) {
  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function loadCompany() {
      try {
        const res = await fetch(`/api/admin/crm/companies/${params.companyId}`)
        const json = await res.json()
        if (json.data) {
          setCompany(json.data)
        } else {
          toast({ title: 'Error', description: 'Empresa no encontrada', variant: 'destructive' })
          router.push('/admin/crm')
        }
      } catch (error) {
        console.error('Error loading company details', error)
      } finally {
        setLoading(false)
      }
    }
    loadCompany()
  }, [params.companyId, router, toast])

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la empresa ${company?.name}? Esto eliminará todos sus usuarios y documentos.`)) {
      return
    }

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
    } catch (error) {
      toast({ title: 'Error', description: 'Ocurrió un error inesperado al eliminar', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/4 bg-muted animate-pulse rounded"></div>
        <div className="card h-64 animate-pulse"></div>
      </div>
    )
  }

  if (!company) return null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link href="/admin/crm" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Volver a Empresas
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">RUT: {company.rut || 'No registrado'}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge variant={company.subscription?.plan === 'PRO' || company.subscription?.plan === 'ENTERPRISE' ? 'success' : 'neutral'}>
            Plan {company.subscription?.plan || 'FREE'}
          </StatusBadge>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? 'Eliminando...' : 'Eliminar Empresa'}
          </Button>
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
        <div className="card md:col-span-2 overflow-hidden">
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
                </tr>
              </thead>
              <tbody>
                {company.users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={u.role === 'ADMIN_COMPANY' ? 'warning' : u.role === 'NOTARY' ? 'success' : 'neutral'}>
                        {u.role}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm">{u._count.documents}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
