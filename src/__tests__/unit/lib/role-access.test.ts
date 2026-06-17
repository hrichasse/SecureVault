import {
  mapDbRoleToAppRole,
  mapAppRoleToDbRole,
  getRoleLabel,
  getRoleShortLabel,
  hasAccess,
} from '@/lib/role-access'

describe('mapDbRoleToAppRole', () => {
  it('ADMIN → admin', () => expect(mapDbRoleToAppRole('ADMIN')).toBe('admin'))
  it('ADMIN_COMPANY → admin_empresa', () => expect(mapDbRoleToAppRole('ADMIN_COMPANY')).toBe('admin_empresa'))
  it('USER → cliente', () => expect(mapDbRoleToAppRole('USER')).toBe('cliente'))
  it('NOTARY → notario', () => expect(mapDbRoleToAppRole('NOTARY')).toBe('notario'))
})

describe('mapAppRoleToDbRole', () => {
  it('admin → ADMIN', () => expect(mapAppRoleToDbRole('admin')).toBe('ADMIN'))
  it('admin_empresa → ADMIN_COMPANY', () => expect(mapAppRoleToDbRole('admin_empresa')).toBe('ADMIN_COMPANY'))
  it('cliente → USER', () => expect(mapAppRoleToDbRole('cliente')).toBe('USER'))
  it('notario → NOTARY', () => expect(mapAppRoleToDbRole('notario')).toBe('NOTARY'))
})

describe('getRoleLabel', () => {
  it('devuelve etiqueta completa para cada rol', () => {
    expect(getRoleLabel('admin')).toBe('Administrador del Sistema')
    expect(getRoleLabel('admin_empresa')).toBe('Administrador de Empresa')
    expect(getRoleLabel('cliente')).toBe('Trabajador')
    expect(getRoleLabel('notario')).toBe('Notario/Certificador')
  })
})

describe('getRoleShortLabel', () => {
  it('devuelve etiqueta corta para cada rol', () => {
    expect(getRoleShortLabel('admin')).toBe('Admin Sistema')
    expect(getRoleShortLabel('admin_empresa')).toBe('Admin Empresa')
    expect(getRoleShortLabel('cliente')).toBe('Trabajador')
    expect(getRoleShortLabel('notario')).toBe('Notario')
  })
})

describe('hasAccess', () => {
  describe('admin — accede a todo', () => {
    it.each(['/dashboard', '/documents', '/requests', '/incidents', '/audit', '/admin'])(
      'puede acceder a %s',
      (path) => expect(hasAccess('admin', path)).toBe(true)
    )
  })

  describe('cliente — acceso restringido', () => {
    it('puede acceder a /dashboard', () => expect(hasAccess('cliente', '/dashboard')).toBe(true))
    it('puede acceder a /documents', () => expect(hasAccess('cliente', '/documents')).toBe(true))
    it('puede acceder a /requests', () => expect(hasAccess('cliente', '/requests')).toBe(true))
    it('NO puede acceder a /incidents', () => expect(hasAccess('cliente', '/incidents')).toBe(false))
    it('NO puede acceder a /audit', () => expect(hasAccess('cliente', '/audit')).toBe(false))
    it('NO puede acceder a /admin', () => expect(hasAccess('cliente', '/admin')).toBe(false))
  })

  describe('notario — solo su área', () => {
    it('puede acceder a /certifications', () => expect(hasAccess('notario', '/certifications')).toBe(true))
    it('NO puede acceder a /requests', () => expect(hasAccess('notario', '/requests')).toBe(false))
    it('NO puede acceder a /incidents', () => expect(hasAccess('notario', '/incidents')).toBe(false))
  })

  describe('rutas desconocidas', () => {
    it('permite cualquier ruta no definida en nav', () => {
      expect(hasAccess('cliente', '/ruta-inexistente')).toBe(true)
    })
  })
})
