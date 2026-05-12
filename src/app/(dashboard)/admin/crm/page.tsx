'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'

interface CompanyCRM {
  id: string
  name: string
  rut: string | null
  createdAt: string
  subscription: {
    plan: string
    status: string
  } | null
  _count: {
    users: number
    documents: number
  }
}

export default function CRMPage() {
  const [companies, setCompanies] = useState<CompanyCRM[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetch('/api/admin/crm/companies')
        const json = await res.json()
        if (json.data) {
          setCompanies(json.data)
        }
      } catch (error) {
        console.error('Error loading CRM companies', error)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Empresas (CRM)</h1>
        <div className="card h-64 animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          Empresas Registradas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona todas las empresas cliente del sistema y sus usuarios.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuarios</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documentos</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Registro</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, i) => (
                <motion.tr
                  key={company.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-card-foreground text-sm">{company.name}</div>
                    <div className="text-xs text-muted-foreground">{company.rut || 'Sin RUT'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge variant={company.subscription?.plan === 'PRO' || company.subscription?.plan === 'ENTERPRISE' ? 'success' : 'neutral'}>
                      {company.subscription?.plan || 'FREE'}
                    </StatusBadge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold">{company._count.users}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-muted-foreground">{company._count.documents}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                    {new Date(company.createdAt).toLocaleDateString('es-CL')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" asChild className="text-primary">
                      <Link href={`/admin/crm/${company.id}`}>
                        Detalles
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {companies.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay empresas registradas en el sistema.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
