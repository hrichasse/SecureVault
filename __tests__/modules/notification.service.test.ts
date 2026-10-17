/**
 * @jest-environment node
 */
import type { AnyEventEnvelope } from '@/lib/messaging/events'

const findMany = jest.fn()
const createMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: (args: unknown) => findMany(args) },
    notification: { createMany: (args: unknown) => createMany(args) },
  },
}))

import { draftNotification, notifyFromEvent } from '@/modules/notifications/notification.service'

const event = <T extends AnyEventEnvelope['type']>(type: T, data: Extract<AnyEventEnvelope, { type: T }>['data']) =>
  ({ id: 'evt-1', type, occurredAt: '2026-10-03T12:00:00.000Z', data }) as AnyEventEnvelope

const uploaded = (confidentialityLevel: string) =>
  event('document.uploaded', { documentId: 'doc-1', companyId: 'c-1', name: 'Contrato', confidentialityLevel, uploadedById: 'u-1' })

describe('draftNotification', () => {
  it('avisa a los admins de la empresa cuando se sube un documento sensible, excepto a quien lo subió', () => {
    expect(draftNotification(uploaded('CRITICO'))).toEqual({
      audience: { kind: 'company-admins', companyId: 'c-1', exceptUserId: 'u-1' },
      title: 'Documento de nivel CRITICO subido',
      body: '"Contrato" fue clasificado como CRITICO.',
      href: '/documents/doc-1',
    })
  })

  it.each(['BAJO', 'MEDIO'])('no avisa por documentos de nivel %s', (level) => {
    expect(draftNotification(uploaded(level))).toBeNull()
  })

  it('el resultado de una solicitud se le avisa a quien la pidió', () => {
    const reviewed = (status: 'APPROVED' | 'REJECTED') =>
      draftNotification(event('access-request.reviewed', { requestId: 'r-1', companyId: 'c-1', documentId: 'doc-1', documentName: 'Contrato', requestedById: 'u-9', status }))

    expect(reviewed('APPROVED')).toMatchObject({ audience: { kind: 'user', userId: 'u-9' }, title: 'Solicitud de acceso aprobada', href: '/documents/doc-1' })
    expect(reviewed('REJECTED')).toMatchObject({ audience: { kind: 'user', userId: 'u-9' }, title: 'Solicitud de acceso rechazada', href: '/documents' })
  })

  it('un mensaje en la DLQ se avisa a los administradores del sistema', () => {
    const draft = draftNotification(
      event('messaging.dead-lettered', { subscription: 'indexer', eventId: 'e-1', eventType: 'document.uploaded', reason: 'PdfUnparseable', description: 'PDF ilegible' })
    )

    expect(draft).toMatchObject({ audience: { kind: 'system-admins' }, href: '/admin/messaging' })
    expect(draft?.body).toBe('Un evento document.uploaded falló en "indexer": PdfUnparseable.')
  })

  it('el evento de demostración se le avisa solo a quien lo lanzó', () => {
    expect(draftNotification(event('demo.requested', { requestedById: 'admin-7', scenario: 'transient' }))).toEqual({
      audience: { kind: 'user', userId: 'admin-7' },
      title: 'Evento de demostración recibido',
      body: 'El notifier recibió el evento «falla transitoria».',
      href: '/admin/messaging',
    })
  })
})

describe('notifyFromEvent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('crea un aviso por destinatario, de forma idempotente (una reentrega no duplica)', async () => {
    findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
    createMany.mockResolvedValue({ count: 2 })

    const created = await notifyFromEvent(
      event('incident.created', { incidentId: 'i-1', companyId: 'c-1', title: 'Fuga de datos', priority: 'HIGH', createdById: 'u-1' })
    )

    expect(created).toBe(2)
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: 'c-1', role: { in: ['ADMIN', 'ADMIN_COMPANY'] }, id: { not: 'u-1' } },
      select: { id: true },
    })
    expect(createMany).toHaveBeenCalledWith({
      data: ['admin-1', 'admin-2'].map((userId) => ({
        userId,
        type: 'incident.created',
        title: 'Nuevo incidente de seguridad',
        body: 'Fuga de datos · prioridad HIGH',
        href: '/incidents/i-1',
        eventId: 'evt-1',
      })),
      skipDuplicates: true,
    })
  })

  it('no escribe nada si el evento no amerita aviso o no hay destinatarios', async () => {
    expect(await notifyFromEvent(uploaded('BAJO'))).toBe(0)

    findMany.mockResolvedValue([])
    expect(await notifyFromEvent(uploaded('ALTO'))).toBe(0)

    expect(createMany).not.toHaveBeenCalled()
  })
})
