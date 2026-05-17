/**
 * Certification Service — lógica para certificar documentos y verificación pública.
 */
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/modules/audit/audit.service'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { randomUUID } from 'crypto'

const BUCKET = 'documents'

export async function certifyDocument(
  documentId: string,
  userId: string,
  companyId: string,
  notaryLicenseNumber?: string,
  observations?: string
) {
  // 1. Obtener documento para extraer el hash SHA-256 ya calculado y la ruta de storage
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId, status: { not: 'DELETED' } },
  })
  
  if (!document) throw new Error('Documento no encontrado')

  // Evitar duplicados (opcional, pero útil)
  const existing = await prisma.certification.findFirst({
    where: { documentId, isValid: true }
  })
  if (existing) return existing

  // 2. Descargar el PDF original desde Supabase
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(document.storagePath)

  if (downloadError || !fileData) {
    throw new Error(`Error al descargar el documento original: ${downloadError?.message}`)
  }

  // 3. Modificar el PDF con pdf-lib (Añadir Sello Notarial)
  const arrayBuffer = await fileData.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  // Dibujar el sello en la esquina superior derecha
  const text = `CERTIFICADO POR SECUREVAULT\nFecha: ${new Date().toLocaleDateString('es-CL')}\nNotario: ${notaryLicenseNumber || 'Interno'}\nHash: ${document.sha256Hash.substring(0, 16)}...`
  firstPage.drawText(text, {
    x: width - 250,
    y: height - 50,
    size: 10,
    font,
    color: rgb(0.1, 0.4, 0.8), // Azul tipo sello
  })

  const modifiedPdfBytes = await pdfDoc.save()
  
  // 4. Subir la versión certificada a Supabase
  const certifiedStoragePath = `certified/${companyId}/${randomUUID()}-certified-${document.originalName}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(certifiedStoragePath, modifiedPdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Error al subir la versión certificada: ${uploadError.message}`)
  }

  return prisma.$transaction(async (tx) => {
    // 5. Crear certificación (Prisma generará cuid() para verificationCode)
    const certification = await tx.certification.create({
      data: {
        documentId,
        certifiedById: userId,
        notaryLicenseNumber: notaryLicenseNumber || null,
        sha256Hash: document.sha256Hash,
        certificateUrl: certifiedStoragePath, // Guardar la ruta del archivo certificado
      },
    })

    // 6. Auditoría
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
          notaryLicenseNumber: notaryLicenseNumber || null,
          signatureProvided: !!notaryLicenseNumber,
          observations: observations || null,
          certificateUrl: certifiedStoragePath,
        },
      },
    })

    return certification
  })
}

export async function getCertifications(companyId?: string) {
  return prisma.certification.findMany({
    where: companyId ? { document: { companyId } } : undefined,
    include: {
      document: { select: { name: true, confidentialityLevel: true, company: { select: { name: true } } } },
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

export async function getPendingCertificationDocuments(companyId?: string) {
  return prisma.document.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: { not: 'DELETED' },
      certifications: {
        none: { isValid: true },
      },
    },
    select: {
      id: true,
      name: true,
      originalName: true,
      createdAt: true,
      confidentialityLevel: true,
      company: { select: { name: true } },
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
