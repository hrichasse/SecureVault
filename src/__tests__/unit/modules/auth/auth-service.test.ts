jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}))

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth-utils'

const mockCreateClient = createClient as jest.Mock
const mockFindUnique = prisma.user.findUnique as jest.Mock

const supabaseUser = { id: 'supabase-uid-001' }
const prismaUser = {
  id: 'prisma-uid-001',
  supabaseId: 'supabase-uid-001',
  email: 'user@empresa.cl',
  name: 'Gustavo Test',
  role: 'USER',
  companyId: 'company-001',
}

describe('getAuthUser()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retorna null si Supabase no tiene sesión activa', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    expect(await getAuthUser()).toBeNull()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('retorna null si el usuario no existe en la BD (Prisma)', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: supabaseUser } }) },
    })
    mockFindUnique.mockResolvedValue(null)
    expect(await getAuthUser()).toBeNull()
  })

  it('retorna el usuario cuando sesión y BD son válidos', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: supabaseUser } }) },
    })
    mockFindUnique.mockResolvedValue(prismaUser)

    const result = await getAuthUser()

    expect(result).toEqual(prismaUser)
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supabaseId: 'supabase-uid-001' } })
    )
  })

  it('retorna null si Supabase lanza excepción (fire-and-forget seguro)', async () => {
    mockCreateClient.mockRejectedValue(new Error('Supabase caído'))
    expect(await getAuthUser()).toBeNull()
  })

  it('retorna null si Prisma lanza excepción', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: supabaseUser } }) },
    })
    mockFindUnique.mockRejectedValue(new Error('DB error'))
    expect(await getAuthUser()).toBeNull()
  })
})
