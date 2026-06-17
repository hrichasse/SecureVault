/**
 * Tests de integración para GET y POST /api/incidents
 * Usa next-test-api-route-handler + supertest.
 */

jest.mock('@/lib/auth-utils', () => ({
  getAuthUser: jest.fn(),
}))

jest.mock('@/modules/incidents/incident.service', () => ({
  getIncidents: jest.fn(),
  createIncident: jest.fn(),
}))

import { testApiHandler } from 'next-test-api-route-handler'
import * as incidentsHandler from '@/app/api/incidents/route'
import { getAuthUser } from '@/lib/auth-utils'
import { getIncidents, createIncident } from '@/modules/incidents/incident.service'

const mockGetAuthUser = getAuthUser as jest.Mock
const mockGetIncidents = getIncidents as jest.Mock
const mockCreateIncident = createIncident as jest.Mock

const authUser = {
  id: 'user-001',
  email: 'gustavo@empresa.cl',
  name: 'Gustavo',
  role: 'ADMIN_COMPANY',
  companyId: 'company-001',
  supabaseId: 'sb-001',
}

const mockIncident = {
  id: 'incident-001',
  title: 'Acceso no autorizado detectado',
  description: 'Se detectó acceso sin permiso al módulo de documentos.',
  type: 'ACCESS_DENIED',
  priority: 'HIGH',
  status: 'OPEN',
  companyId: 'company-001',
  createdById: 'user-001',
}

describe('GET /api/incidents', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retorna 401 si no hay sesión activa', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(401)
        const json = await res.json()
        expect(json.error).toBe('No autorizado')
      },
    })
  })

  it('retorna 200 con lista de incidentes para usuario autenticado', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)
    mockGetIncidents.mockResolvedValue([mockIncident])

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.data).toHaveLength(1)
        expect(json.data[0].title).toBe('Acceso no autorizado detectado')
      },
    })
  })

  it('pasa companyId del usuario autenticado al servicio', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)
    mockGetIncidents.mockResolvedValue([])

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        await fetch({ method: 'GET' })
        expect(mockGetIncidents).toHaveBeenCalledWith(
          expect.objectContaining({ companyId: 'company-001' })
        )
      },
    })
  })
})

describe('POST /api/incidents', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retorna 401 si no hay sesión activa', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', description: 'Test description', type: 'OTHER' }),
        })
        expect(res.status).toBe(401)
      },
    })
  })

  it('retorna 400 si el título tiene menos de 5 caracteres', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Err',
            description: 'Descripción larga suficiente para pasar validación.',
            type: 'OTHER',
          }),
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toMatch(/título/)
      },
    })
  })

  it('retorna 400 si la descripción tiene menos de 10 caracteres', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Título válido',
            description: 'Corto',
            type: 'OTHER',
          }),
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toMatch(/descripción/)
      },
    })
  })

  it('retorna 400 si el tipo de incidente no es válido', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Título válido',
            description: 'Descripción suficientemente larga.',
            type: 'TIPO_INVALIDO',
          }),
        })
        expect(res.status).toBe(400)
      },
    })
  })

  it('retorna 201 con el incidente creado cuando los datos son válidos', async () => {
    mockGetAuthUser.mockResolvedValue(authUser)
    mockCreateIncident.mockResolvedValue(mockIncident)

    await testApiHandler({
      appHandler: incidentsHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Acceso no autorizado detectado',
            description: 'Se detectó acceso sin permiso al módulo de documentos.',
            type: 'ACCESS_DENIED',
            priority: 'HIGH',
          }),
        })
        expect(res.status).toBe(201)
        const json = await res.json()
        expect(json.data.type).toBe('ACCESS_DENIED')
        expect(json.data.priority).toBe('HIGH')
      },
    })
  })
})
