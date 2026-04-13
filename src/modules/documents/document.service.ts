/**
 * Document Service — lógica de negocio para documentos.
 *
 * Orquesta: Storage (Supabase) + BD (Prisma) + Clasificación + AuditLog.
 */

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { classifyDocument } from '@/modules/classification/classifier'
import {
  createDocument,
  listDocuments,
  findDocumentById,
  softDeleteDocument,
  type ListDocumentsOptions,
} from './document.repository'
import type { ConfidentialityLevel } from '@/types'

const BUCKET = 'documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── Asegurar bucket existe ─────────────────────────────────

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
  })
  // Ignorar si ya existe
  if (error && !error.message.toLowerCase().includes('already exists')) {
    console.error('[DocumentService] Error creating bucket:', error.message)
  }
}

// ── uploadDocument ─────────────────────────────────────────

export interface UploadDocumentInput {
  file: File
  description?: string
  overrideLevel?: ConfidentialityLevel
  companyId: string
  uploadedById: string
}

export async function uploadDocument({
  file,
  description,
  overrideLevel,
  companyId,
  uploadedById,
}: UploadDocumentInput) {
  // 1. Validaciones
  if (file.type !== 'application/pdf') {
    throw new Error('Solo se permiten archivos PDF')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo no puede superar 10MB')
  }

  // 2. Leer buffer y calcular SHA-256
  const buffer = Buffer.from(await file.arrayBuffer())
  const sha256Hash = createHash('sha256').update(buffer).digest('hex')

  // 3. Clasificar documento
  const classification = classifyDocument(file.name, description)
  const confidentialityLevel = overrideLevel ?? classification.level

  // 4. Preparar ruta en Storage
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${companyId}/${randomUUID()}-${safeFilename}`

  // 5. Asegurar bucket y subir a Supabase Storage
  await ensureBucket()
  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (storageError) {
    throw new Error(`Error al subir archivo: ${storageError.message}`)
  }

  // 6. Guardar en BD (transacción: Document + AuditLog)
  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        name: file.name.replace(/\.[^/.]+$/, ''), // sin extensión
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256Hash,
        storagePath,
        confidentialityLevel,
        classificationScore: classification.score,
        description: description || null,
        companyId,
        uploadedById,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    })

    // AuditLog
    await tx.auditLog.create({
      data: {
        action: 'UPLOAD_DOCUMENT',
        userId: uploadedById,
        companyId,
        documentId: doc.id,
        metadata: {
          filename: file.name,
          confidentialityLevel,
          classificationScore: classification.score,
          matchedTerms: classification.matchedTerms,
          overrideApplied: !!overrideLevel,
          sizeBytes: file.size,
        },
      },
    })

    return doc
  })

  return {
    ...document,
    classification: {
      level: classification.level,
      score: classification.score,
      matchedTerms: classification.matchedTerms,
      overrideApplied: !!overrideLevel,
    },
  }
}

// ── getDocuments ───────────────────────────────────────────

export { listDocuments as getDocuments, findDocumentById as getDocumentById }

// ── deleteDocument ─────────────────────────────────────────

export async function deleteDocument(
  id: string,
  companyId: string,
  userId: string
) {
  const doc = await findDocumentById(id, companyId)
  if (!doc) throw new Error('Documento no encontrado')

  await prisma.$transaction(async (tx) => {
    // Soft delete en BD
    await tx.document.updateMany({
      where: { id, companyId },
      data: { status: 'DELETED' },
    })

    // AuditLog
    await tx.auditLog.create({
      data: {
        action: 'DELETE_DOCUMENT',
        userId,
        companyId,
        documentId: id,
        metadata: { filename: doc.originalName },
      },
    })
  })

  return { success: true }
}

// ── getDocumentSignedUrl ────────────────────────────────────

export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error) throw new Error(`Error generando URL firmada: ${error.message}`)
  return data.signedUrl
}
