import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { indexDocumentFromStorage } from '@/modules/documents/indexing.service'

/**
 * POST /api/admin/rag/index-all
 *
 * Indexa para el RAG los documentos activos que aún no tienen fragmentos.
 * Con body { "reindex": true } vuelve a indexar TODOS (p. ej. después de
 * cambiar cómo se divide el texto o el modelo de embeddings).
 *
 * - ADMIN_COMPANY: documentos de su empresa.
 * - ADMIN (sistema): documentos de todas las empresas.
 *
 * Usa el mismo camino que el indexador del bus de mensajes
 * (indexDocumentFromStorage), así el resultado es idéntico.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user || !['ADMIN', 'ADMIN_COMPANY'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const reindex = body?.reindex === true

    const documents = await prisma.document.findMany({
      where: {
        ...(user.role === 'ADMIN' ? {} : { companyId: user.companyId }),
        status: 'ACTIVE',
        ...(reindex ? {} : { chunks: { none: {} } }),
      },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    if (documents.length === 0) {
      return NextResponse.json({ message: 'Todos los documentos ya están indexados.', indexed: 0 })
    }

    let totalChunks = 0
    const results: { name: string; chunks: number; status: string; error?: string }[] = []

    // De a uno: la API de embeddings tiene límite de solicitudes por minuto
    for (const doc of documents) {
      try {
        const outcome = await indexDocumentFromStorage(doc.id)
        const chunks = outcome.status === 'indexed' ? outcome.chunks : 0
        totalChunks += chunks
        results.push({
          name: doc.name,
          chunks,
          status: outcome.status === 'indexed' ? 'indexado' : `omitido (${outcome.reason})`,
        })
      } catch (err) {
        console.error(`[RAG Index] Error processing ${doc.name}:`, err)
        results.push({
          name: doc.name,
          chunks: 0,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      message: `Indexación completada: ${totalChunks} fragmentos en ${results.filter((r) => r.chunks > 0).length} de ${documents.length} documentos.`,
      indexed: totalChunks,
      details: results,
    })
  } catch (error) {
    console.error('[POST /api/admin/rag/index-all]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
