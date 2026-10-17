/**
 * Notification Service — avisos in-app (la campana del panel).
 *
 * Los crea el consumidor "notifier" del bus de mensajes a partir de eventos de
 * dominio. La escritura es idempotente: (userId, eventId) es único, así que una
 * reentrega del mismo evento no duplica avisos.
 */

import { prisma } from '@/lib/prisma'
import type { AnyEventEnvelope } from '@/lib/messaging/events'
import { DEMO_LABELS } from '@/lib/messaging/demo'

export type Audience =
  | { kind: 'company-admins'; companyId: string; exceptUserId?: string }
  | { kind: 'user'; userId: string }
  | { kind: 'system-admins' }

export interface NotificationDraft {
  audience: Audience
  title: string
  body: string
  href: string
}

const SENSITIVE_LEVELS = ['ALTO', 'CRITICO']

/** Traduce un evento a un aviso. Devuelve null si el evento no amerita notificar. */
export function draftNotification(event: AnyEventEnvelope): NotificationDraft | null {
  switch (event.type) {
    case 'document.uploaded': {
      const { documentId, companyId, name, confidentialityLevel, uploadedById } = event.data
      if (!SENSITIVE_LEVELS.includes(confidentialityLevel)) return null
      return {
        audience: { kind: 'company-admins', companyId, exceptUserId: uploadedById },
        title: `Documento de nivel ${confidentialityLevel} subido`,
        body: `"${name}" fue clasificado como ${confidentialityLevel}.`,
        href: `/documents/${documentId}`,
      }
    }
    case 'incident.created': {
      const { incidentId, companyId, title, priority, createdById } = event.data
      return {
        audience: { kind: 'company-admins', companyId, exceptUserId: createdById },
        title: 'Nuevo incidente de seguridad',
        body: `${title} · prioridad ${priority}`,
        href: `/incidents/${incidentId}`,
      }
    }
    case 'access-request.created': {
      const { companyId, documentName, requesterName, requestedById } = event.data
      return {
        audience: { kind: 'company-admins', companyId, exceptUserId: requestedById },
        title: 'Nueva solicitud de acceso',
        body: `${requesterName} solicita acceso a "${documentName}".`,
        href: '/requests',
      }
    }
    case 'access-request.reviewed': {
      const { documentId, documentName, requestedById, status } = event.data
      const approved = status === 'APPROVED'
      return {
        audience: { kind: 'user', userId: requestedById },
        title: approved ? 'Solicitud de acceso aprobada' : 'Solicitud de acceso rechazada',
        body: `Tu solicitud de acceso a "${documentName}" fue ${approved ? 'aprobada' : 'rechazada'}.`,
        href: approved ? `/documents/${documentId}` : '/documents',
      }
    }
    case 'messaging.dead-lettered': {
      const { subscription, eventType, reason } = event.data
      return {
        audience: { kind: 'system-admins' },
        title: 'Mensaje en la cola de errores (DLQ)',
        body: `Un evento ${eventType} falló en "${subscription}": ${reason}.`,
        href: '/admin/messaging',
      }
    }
    case 'demo.requested': {
      const { requestedById, scenario } = event.data
      return {
        audience: { kind: 'user', userId: requestedById },
        title: 'Evento de demostración recibido',
        body: `El notifier recibió el evento «${DEMO_LABELS[scenario]}».`,
        href: '/admin/messaging',
      }
    }
  }
}

async function resolveRecipients(audience: Audience): Promise<string[]> {
  if (audience.kind === 'user') return [audience.userId]

  const users = await prisma.user.findMany({
    where:
      audience.kind === 'system-admins'
        ? { role: 'ADMIN' }
        : {
            companyId: audience.companyId,
            role: { in: ['ADMIN', 'ADMIN_COMPANY'] },
            ...(audience.exceptUserId && { id: { not: audience.exceptUserId } }),
          },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/** Handler del suscriptor "notifier". Devuelve cuántos avisos nuevos creó. */
export async function notifyFromEvent(event: AnyEventEnvelope): Promise<number> {
  const draft = draftNotification(event)
  if (!draft) return 0

  const recipients = await resolveRecipients(draft.audience)
  if (recipients.length === 0) return 0

  const { count } = await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: event.type,
      title: draft.title,
      body: draft.body,
      href: draft.href,
      eventId: event.id,
    })),
    skipDuplicates: true,
  })
  return count
}

// ── Lectura para la campana ────────────────────────────────

export async function listNotifications(userId: string, limit = 15) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return { items, unreadCount }
}

export async function markAllNotificationsRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return count
}
