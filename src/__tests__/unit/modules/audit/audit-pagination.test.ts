jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getAuditLogs } from '@/modules/audit/audit.service'

const mockFindMany = prisma.auditLog.findMany as jest.Mock
const mockCount = prisma.auditLog.count as jest.Mock

describe('getAuditLogs() — paginación', () => {
  beforeEach(() => jest.clearAllMocks())

  it('usa page=1 y limit=20 por defecto', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(5)

    const result = await getAuditLogs({ companyId: 'company-1' })

    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
  })

  it('calcula totalPages correctamente — ceil(45/20) = 3', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(45)

    const result = await getAuditLogs({ companyId: 'company-1', page: 1, limit: 20 })

    expect(result.pagination.totalPages).toBe(3)
    expect(result.pagination.total).toBe(45)
  })

  it('calcula skip correcto para page=3, limit=10 → skip=20', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(100)

    await getAuditLogs({ companyId: 'company-1', page: 3, limit: 10 })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })

  it('filtra por companyId en todas las queries', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getAuditLogs({ companyId: 'mi-empresa' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'mi-empresa' }) })
    )
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'mi-empresa' }) })
    )
  })

  it('filtra por acción cuando se proporciona', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getAuditLogs({ companyId: 'company-1', action: 'LOGIN' as any })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'LOGIN' }) })
    )
  })

  it('filtra por rango de fechas — gte y lte presentes', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getAuditLogs({ companyId: 'company-1', startDate: '2024-01-01', endDate: '2024-01-31' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })

  it('retorna data vacía y totalPages=0 si no hay logs', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const result = await getAuditLogs({ companyId: 'company-1' })

    expect(result.data).toEqual([])
    expect(result.pagination.totalPages).toBe(0)
  })
})
