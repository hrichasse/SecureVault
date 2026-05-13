import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { indexDocument } from '@/lib/embeddings'

const BUCKET = 'documents'

/**
 * POST /api/admin/rag/index-all
 * 
 * Indexa todos los documentos activos de la empresa que aún no tienen chunks.
 * Solo accesible por ADMIN o ADMIN_COMPANY.
 */
export async function POST() {
  try {
    const user = await getAuthUser()
    if (!user || !['ADMIN', 'ADMIN_COMPANY'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Buscar documentos sin chunks
    const documents = await prisma.document.findMany({
      where: {
        companyId: user.companyId,
        status: 'ACTIVE',
        chunks: { none: {} },
      },
      select: {
        id: true,
        name: true,
        storagePath: true,
      },
    })

    if (documents.length === 0) {
      return NextResponse.json({ 
        message: 'Todos los documentos ya están indexados.', 
        indexed: 0 
      })
    }

    let totalIndexed = 0
    const results: { name: string; chunks: number; error?: string }[] = []

    for (const doc of documents) {
      try {
        // Descargar PDF
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from(BUCKET)
          .download(doc.storagePath)

        if (dlError || !fileData) {
          results.push({ name: doc.name, chunks: 0, error: 'No se pudo descargar' })
          continue
        }

        // Extraer texto
        const buffer = Buffer.from(await fileData.arrayBuffer())
        // @ts-ignore — pdf-parse v1 uses CommonJS default export
        const pdfParse = (await import('pdf-parse')).default
        const parsed = await pdfParse(buffer)

        if (!parsed.text || parsed.text.trim().length < 50) {
          results.push({ name: doc.name, chunks: 0, error: 'Sin texto extraíble' })
          continue
        }

        // Indexar
        const chunksCreated = await indexDocument(doc.id, parsed.text)
        totalIndexed += chunksCreated
        results.push({ name: doc.name, chunks: chunksCreated })
      } catch (err) {
        console.error(`[RAG Index] Error processing ${doc.name}:`, err)
        results.push({ name: doc.name, chunks: 0, error: String(err) })
      }

      // Pausa entre documentos para respetar rate limits
      await new Promise(r => setTimeout(r, 1000))
    }

    return NextResponse.json({ 
      message: `Indexación completada. ${totalIndexed} chunks creados.`,
      indexed: totalIndexed,
      details: results,
    })
  } catch (error) {
    console.error('[POST /api/admin/rag/index-all]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
