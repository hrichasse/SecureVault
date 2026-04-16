'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Plus, X, Eye, EyeOff, Pencil, Trash2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

type DbRole = 'ADMIN' | 'ADMIN_COMPANY' | 'USER' | 'NOTARY'
type AppRole = 'admin' | 'admin_empresa' | 'cliente' | 'notario'
type AppRole = 'admin' | 'admin_empresa' | 'cliente' | 'notario'

interface CurrentUser {
  id: string
  role: DbRole
}

interface UserItem {
  id: string
  name: string
  email: string
  role: DbRole
  createdAt: string
  company?: {
    id: string
    name: string
  }
}

const ROLE_LABELS: Record<DbRole, string> = {
  ADMIN: 'Administrador del Sistema',
  ADMIN_COMPANY: 'Administrador de Empresa',
  USER: 'Trabajador',
  NOTARY: 'Notario',
}

const ROLE_VARIANT: Record<DbRole, 'info' | 'warning' | 'neutral' | 'success'> = {
  ADMIN: 'info',
  ADMIN_COMPANY: 'warning',
  USER: 'neutral',
  NOTARY: 'success',
}

const CREATABLE_BY: Record<DbRole, DbRole[]> = {
  ADMIN: ['ADMIN', 'ADMIN_COMPANY', 'USER', 'NOTARY'],
  ADMIN_COMPANY: ['USER', 'NOTARY'],
  USER: [],
  NOTARY: [],
}

const emptyCreateForm = {
  name: '',
  email: '',
  password: '',
  role: 'USER' as DbRole,
  companyName: '',
  companyRut: '',
  companyAddress: '',
  companyBusinessLine: '',
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [editRole, setEditRole] = useState<DbRole>('USER')
  const [editLoading, setEditLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/auth/me').then(r => r.json()),
      ])
      setUsers(usersRes.data || [])
      if (meRes.data) {
        setCurrentUser({ id: meRes.data.id, role: meRes.data.role })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la lista de usuarios.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const creatableRoles = currentUser ? CREATABLE_BY[currentUser.role] : []
  const isSystemAdmin = currentUser?.role === 'ADMIN'

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    if (createForm.role === 'ADMIN_COMPANY') {
      if (!createForm.companyName || !createForm.companyRut || !createForm.companyAddress || !createForm.companyBusinessLine) {
        toast({
          title: 'Datos incompletos',
          description: 'Para crear Administrador de Empresa debes completar nombre, RUT, direccion y giro.',
          variant: 'destructive',
        })
        setCreating(false)
        return
      }
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear usuario')

      toast({
        title: 'Usuario creado',
        description: `${createForm.name} fue creado como ${ROLE_LABELS[createForm.role]}.`,
      })

      setCreateForm(emptyCreateForm)
      setShowCreate(false)
      await loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleEditRole = async () => {
    if (!editTarget) return
    setEditLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editTarget.id, role: editRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cambiar rol')
      toast({ title: 'Rol actualizado', description: `${editTarget.name} ahora es ${ROLE_LABELS[editRole]}` })
      setEditTarget(null)
      await loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/users?userId=${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar usuario')
      toast({ title: 'Usuario eliminado', description: `${deleteTarget.name} fue eliminado.` })
      setDeleteTarget(null)
      await loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Gestion de Equipo</h1>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion de Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSystemAdmin
              ? 'Administra cuentas globales y administradores de empresa.'
              : 'Administra trabajadores y notarios de tu empresa.'}
          </p>
        </div>
        {creatableRoles.length > 0 && (
          <Button className="gradient-primary text-primary-foreground" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar usuario
          </Button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rol</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Empresa</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const isMe = user.id === currentUser?.id
                const canEdit = !isMe && creatableRoles.includes(user.role)
                const canDelete = !isMe && (
                  currentUser?.role === 'ADMIN' ||
                  (currentUser?.role === 'ADMIN_COMPANY' && (user.role === 'USER' || user.role === 'NOTARY'))
                )

                return (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-card-foreground">{user.name}{isMe ? ' (tu)' : ''}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground hidden sm:table-cell">{user.email}</td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={ROLE_VARIANT[user.role]}>{ROLE_LABELS[user.role]}</StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">{user.company?.name || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Cambiar rol"
                            onClick={() => {
                              setEditTarget(user)
                              setEditRole(user.role)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Eliminar"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-xl p-6 max-h-[90vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Agregar usuario
                </h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="label">Rol</label>
                  <select
                    className="input"
                    value={createForm.role}
                    onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value as DbRole }))}
                  >
                    {creatableRoles.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>

                {createForm.role === 'ADMIN_COMPANY' && (
                  <div className="space-y-3 rounded-xl border border-border p-3 bg-muted/20">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Datos de empresa
                    </p>
                    <input className="input" placeholder="Nombre empresa" value={createForm.companyName} onChange={(e) => setCreateForm(f => ({ ...f, companyName: e.target.value }))} />
                    <input className="input" placeholder="RUT empresa" value={createForm.companyRut} onChange={(e) => setCreateForm(f => ({ ...f, companyRut: e.target.value }))} />
                    <input className="input" placeholder="Direccion" value={createForm.companyAddress} onChange={(e) => setCreateForm(f => ({ ...f, companyAddress: e.target.value }))} />
                    <input className="input" placeholder="Giro" value={createForm.companyBusinessLine} onChange={(e) => setCreateForm(f => ({ ...f, companyBusinessLine: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Administrador: {createForm.name || '(se completara con el nombre del usuario)'}</p>
                  </div>
                )}

                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input" required minLength={2} value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" required value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Contrasena temporal</label>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 gradient-primary text-primary-foreground" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear usuario'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-bold text-foreground mb-4">Cambiar rol</h3>
              <div className="grid gap-2 mb-5">
                {creatableRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="editRole"
                      checked={editRole === role}
                      onChange={() => setEditRole(role)}
                    />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleEditRole} disabled={editLoading}>
                  {editLoading ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editLoading}>Cancelar</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-bold text-foreground mb-2">Eliminar usuario</h3>
              <p className="text-sm text-muted-foreground mb-5">¿Eliminar a {deleteTarget.name}?</p>
              <div className="flex gap-3">
                <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleteLoading}>
                  {deleteLoading ? 'Eliminando...' : 'Si, eliminar'}
                </Button>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancelar</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
