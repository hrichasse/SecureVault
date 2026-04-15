'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Search, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion } from 'framer-motion'

interface Document {
  id: string
  name: string
  confidentialityLevel: string
  createdAt: string
  status: string
  sizeBytes: number
}

const levelMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  BAJO: 'low', MEDIO: 'medium', ALTO: 'high', CRITICO: 'critical',
}
const levelLabel: Record<string, string> = {
  BAJO: 'BAJO', MEDIO: 'MEDIO', ALTO: 'ALTO', CRITICO: 'CRÍTICO',
}
const filters = ['Todos', 'Bajo', 'Medio', 'Alto', 'Crítico']

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/documents')
      .then(res => res.json())
      .then(data => setDocuments(data.data?.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = documents.filter(d => {
    const matchesFilter = activeFilter === 'Todos' || d.confidentialityLevel.toLowerCase() === activeFilter.toLowerCase()
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Documentos</h1></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card rounded-xl border border-border animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">Gestión de documentos corporativos</p>
        </div>
        <Button className="gradient-primary text-primary-foreground" onClick={() => router.push('/documents/upload')}>
          <Upload className="h-4 w-4 mr-2" />
          Subir documento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar documentos..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <Button
              key={f}
              variant={activeFilter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(f)}
              className={activeFilter === f ? 'gradient-primary text-primary-foreground' : ''}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confidencialidad</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tamaño</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc, i) => (
              <motion.tr
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => router.push(`/documents/${doc.id}`)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-card-foreground">{doc.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <StatusBadge variant={levelMap[doc.confidentialityLevel] || 'neutral'}>
                    {levelLabel[doc.confidentialityLevel] || doc.confidentialityLevel}
                  </StatusBadge>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString('es-CL')}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge variant={doc.status === 'ACTIVE' ? 'success' : doc.status === 'ARCHIVED' ? 'warning' : 'neutral'}>
                    {doc.status === 'ACTIVE' ? 'Activo' : doc.status === 'ARCHIVED' ? 'Archivado' : doc.status}
                  </StatusBadge>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{formatSize(doc.sizeBytes)}</td>
                <td className="py-3 px-4 text-right">
                  <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No se encontraron documentos</div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(doc => (
          <div
            key={doc.id}
            className="bg-card rounded-xl border border-border p-4 shadow-card cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => router.push(`/documents/${doc.id}`)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-card-foreground">{doc.name}</span>
              </div>
              <StatusBadge variant={levelMap[doc.confidentialityLevel] || 'neutral'}>
                {levelLabel[doc.confidentialityLevel] || doc.confidentialityLevel}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{new Date(doc.createdAt).toLocaleDateString('es-CL')}</span>
              <span>{formatSize(doc.sizeBytes)}</span>
              <StatusBadge variant={doc.status === 'ACTIVE' ? 'success' : 'warning'}>
                {doc.status === 'ACTIVE' ? 'Activo' : doc.status}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
