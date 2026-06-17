import {
  mapDbRoleToAppRole,
  mapAppRoleToDbRole,
  getRoleLabel,
  getRoleShortLabel,
  hasAccess,
} from '@/lib/role-access'

describe('role-access utilities', () => {
  describe('mapDbRoleToAppRole', () => {
    it('should correctly map db roles to app roles', () => {
      expect(mapDbRoleToAppRole('ADMIN')).toBe('admin')
      expect(mapDbRoleToAppRole('ADMIN_COMPANY')).toBe('admin_empresa')
      expect(mapDbRoleToAppRole('USER')).toBe('cliente')
      expect(mapDbRoleToAppRole('NOTARY')).toBe('notario')
    })
  })

  describe('mapAppRoleToDbRole', () => {
    it('should correctly map app roles to db roles', () => {
      expect(mapAppRoleToDbRole('admin')).toBe('ADMIN')
      expect(mapAppRoleToDbRole('admin_empresa')).toBe('ADMIN_COMPANY')
      expect(mapAppRoleToDbRole('cliente')).toBe('USER')
      expect(mapAppRoleToDbRole('notario')).toBe('NOTARY')
    })
  })

  describe('getRoleLabel', () => {
    it('should return the correct label for each role', () => {
      expect(getRoleLabel('admin')).toBe('Administrador del Sistema')
      expect(getRoleLabel('admin_empresa')).toBe('Administrador de Empresa')
      expect(getRoleLabel('cliente')).toBe('Trabajador')
      expect(getRoleLabel('notario')).toBe('Notario/Certificador')
    })
  })

  describe('getRoleShortLabel', () => {
    it('should return the correct short label for each role', () => {
      expect(getRoleShortLabel('admin')).toBe('Admin Sistema')
      expect(getRoleShortLabel('admin_empresa')).toBe('Admin Empresa')
      expect(getRoleShortLabel('cliente')).toBe('Trabajador')
      expect(getRoleShortLabel('notario')).toBe('Notario')
    })
  })

  describe('hasAccess', () => {
    it('should grant access to dashboard for all roles', () => {
      expect(hasAccess('admin', '/dashboard')).toBe(true)
      expect(hasAccess('admin_empresa', '/dashboard')).toBe(true)
      expect(hasAccess('cliente', '/dashboard')).toBe(true)
      expect(hasAccess('notario', '/dashboard')).toBe(true)
    })

    it('should grant access to documents for all roles', () => {
      expect(hasAccess('admin', '/documents')).toBe(true)
      expect(hasAccess('admin_empresa', '/documents')).toBe(true)
      expect(hasAccess('cliente', '/documents')).toBe(true)
      expect(hasAccess('notario', '/documents')).toBe(true)
    })

    it('should restrict requests access to admin, admin_empresa, and cliente', () => {
      expect(hasAccess('admin', '/requests')).toBe(true)
      expect(hasAccess('admin_empresa', '/requests')).toBe(true)
      expect(hasAccess('cliente', '/requests')).toBe(true)
      expect(hasAccess('notario', '/requests')).toBe(false)
    })

    it('should restrict incidents access to admin and admin_empresa', () => {
      expect(hasAccess('admin', '/incidents')).toBe(true)
      expect(hasAccess('admin_empresa', '/incidents')).toBe(true)
      expect(hasAccess('cliente', '/incidents')).toBe(false)
      expect(hasAccess('notario', '/incidents')).toBe(false)
    })

    it('should restrict certifications access to admin, admin_empresa, and notario', () => {
      expect(hasAccess('admin', '/certifications')).toBe(true)
      expect(hasAccess('admin_empresa', '/certifications')).toBe(true)
      expect(hasAccess('cliente', '/certifications')).toBe(false)
      expect(hasAccess('notario', '/certifications')).toBe(true)
    })

    it('should restrict team management to admin and admin_empresa', () => {
      expect(hasAccess('admin', '/admin')).toBe(true)
      expect(hasAccess('admin_empresa', '/admin')).toBe(true)
      expect(hasAccess('cliente', '/admin')).toBe(false)
      expect(hasAccess('notario', '/admin')).toBe(false)
    })

    it('should allow access to unknown routes (delegated to middleware)', () => {
      expect(hasAccess('cliente', '/unknown-route')).toBe(true)
    })
  })
})
