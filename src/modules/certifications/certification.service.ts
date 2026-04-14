/**
 * Certification Service — lógica para certificar documentos y verificación pública.
 */
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/modules/audit/audit.service'

export async function certifyDocument(
  documentId: string,
  userId: string,
  companyId: string
) {
  // 1. Obtener documento para extraer el hash SHA-256 ya calculado
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId, status: { not: 'DELETED' } },
  })
  
  if (!document) throw new Error('Documento no encontrado')

  // Evitar duplicados (opcional, pero útil)
  const existing = await prisma.certification.findFirst({
    where: { documentId, isValid: true }
  })
  if (existing) return existing

  return prisma.$transaction(async (tx) => {
    // 2. Crear certificación (Prisma generará cuid() para verificationCode)
    const certification = await tx.certification.create({
      data: {
        documentId,
        certifiedById: userId,
        sha256Hash: document.sha256Hash,
      },
    })

    // 3. Auditoría
    await tx.auditLog.create({
      data: {
        action: 'CERTIFY_DOCUMENT',
        userId,
        companyId,
        documentId,
        metadata: {
          certificationId: certification.id,
          verificationCode: certification.verificationCode,
          sha256Hash: document.sha256Hash,
        },
      },
    })

    return certification
  })
}

export async function getCertifications(companyId: string) {
  return prisma.certification.findMany({
    where: { document: { companyId } },
    include: {
      document: { select: { name: true, confidentialityLevel: true } },
      certifiedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function verifyCertification(code: string) {
  const cert = await prisma.certification.findUnique({
    where: { verificationCode: code },
    include: {
      document: {
        select: {
          name: true,
          companyId: true,
          company: { select: { name: true } },
        },
      },
    },
  })

  // Registrar verificación — fire-and-forget via logEvent
  if (cert) {
    await logEvent({
      action: 'VERIFY_DOCUMENT',
      documentId: cert.documentId,
      companyId: cert.document.companyId,
      metadata: { success: true, verificationCode: code },
    })
  }

  return cert
}
