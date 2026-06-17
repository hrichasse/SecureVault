/**
 * Tests de integración para POST /api/auth/login
 * Usa next-test-api-route-handler + supertest para simular peticiones HTTP reales
 * contra el handler de Next.js sin levantar el servidor completo.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}))

import { testApiHandler } from 'next-test-api-route-handler'
import * as loginHandler from '@/app/api/auth/login/route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const mockCreateClient = createClient as jest.Mock
const mockFindUnique = prisma.user.findUnique as jest.Mock

const mockPrismaUser = {
  id: 'user-123',
  supabaseId: 'sb-uid-001',
  email: 'gustavo@empresa.cl',
  name: 'Gustavo Gutierrez',
  role: 'USER',
  companyId: 'company-001',
  company: { id: 'company-001', name: 'Empresa Demo', email: 'empresa@demo.cl' },
}

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('validación de entrada (400)', () => {
    it('rechaza body con email inválido', async () => {
      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'no-es-email', password: 'password123' }),
          })
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(json.error).toBe('Datos inválidos')
        },
      })
    })

    it('rechaza body con contraseña menor a 8 caracteres', async () => {
      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@test.cl', password: '123' }),
          })
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(json.error).toBe('Datos inválidos')
        },
      })
    })

    it('rechaza body vacío', async () => {
      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          expect(res.status).toBe(400)
        },
      })
    })
  })

  describe('credenciales incorrectas (401)', () => {
    it('retorna 401 si Supabase rechaza las credenciales', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid credentials' },
          }),
        },
      })

      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@test.cl', password: 'wrongpassword' }),
          })
          expect(res.status).toBe(401)
          const json = await res.json()
          expect(json.error).toBe('Credenciales incorrectas')
        },
      })
    })
  })

  describe('usuario no existe en BD (404)', () => {
    it('retorna 404 si Supabase autentica pero el usuario no está en Prisma', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { id: 'sb-uid-001' } },
            error: null,
          }),
        },
      })
      mockFindUnique.mockResolvedValue(null)

      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'ghost@test.cl', password: 'password123' }),
          })
          expect(res.status).toBe(404)
          const json = await res.json()
          expect(json.error).toBe('Usuario no encontrado en el sistema')
        },
      })
    })
  })

  describe('login exitoso (200)', () => {
    it('retorna 200 con el usuario cuando las credenciales son correctas', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { id: 'sb-uid-001' } },
            error: null,
          }),
        },
      })
      mockFindUnique.mockResolvedValue(mockPrismaUser)

      await testApiHandler({
        appHandler: loginHandler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'gustavo@empresa.cl', password: 'password123' }),
          })
          expect(res.status).toBe(200)
          const json = await res.json()
          expect(json.success).toBe(true)
          expect(json.user.email).toBe('gustavo@empresa.cl')
          expect(json.user.role).toBe('USER')
        },
      })
    })
  })
})
