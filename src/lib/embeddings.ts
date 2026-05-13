/**
 * Embeddings Service — genera embeddings con Gemini y busca por similitud coseno.
 * 
 * Usado por el sistema RAG del VaultAssistant para buscar contenido
 * relevante dentro de los documentos de la empresa.
 */

import { prisma } from '@/lib/prisma'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'

// ── Generar embedding para un texto ─────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    console.error('[Embeddings] Error generating embedding:', error)
    throw new Error(`Error generando embedding: ${error?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return data.embedding.values as number[]
}

// ── Similitud coseno entre dos vectores ─────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ── Dividir texto en chunks ─────────────────────────────────

export function splitTextIntoChunks(text: string, maxChunkSize = 800): string[] {
  // Limpiar texto
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!clean) return []

  // Dividir por párrafos dobles primero
  const paragraphs = clean.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChunkSize && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.filter(c => c.length > 20) // ignorar chunks muy cortos
}

// ── Indexar un documento (generar chunks + embeddings) ──────

export async function indexDocument(documentId: string, text: string): Promise<number> {
  const chunks = splitTextIntoChunks(text)

  if (chunks.length === 0) {
    console.warn(`[Embeddings] Document ${documentId} has no extractable text.`)
    return 0
  }

  // Borrar chunks anteriores si existen (re-indexación)
  await prisma.documentChunk.deleteMany({ where: { documentId } })

  // Generar embeddings en lotes para no saturar la API
  const BATCH_SIZE = 5
  let indexed = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    
    const embeddingPromises = batch.map(async (chunk, batchIdx) => {
      try {
        const embedding = await generateEmbedding(chunk)
        return {
          documentId,
          chunkIndex: i + batchIdx,
          content: chunk,
          embedding: embedding as unknown as Prisma.InputJsonValue,
        }
      } catch (err) {
        console.error(`[Embeddings] Failed to embed chunk ${i + batchIdx}:`, err)
        return null
      }
    })

    const results = (await Promise.all(embeddingPromises)).filter(Boolean)
    
    if (results.length > 0) {
      await prisma.documentChunk.createMany({
        // @ts-expect-error — Prisma Json type matches our data
        data: results,
      })
      indexed += results.length
    }

    // Pausa entre lotes para respetar rate limits
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`[Embeddings] Indexed ${indexed} chunks for document ${documentId}`)
  return indexed
}

// ── Búsqueda semántica en los chunks de una empresa ─────────

export interface SemanticSearchResult {
  content: string
  documentName: string
  similarity: number
}

export async function semanticSearch(
  query: string,
  companyId: string,
  topK = 5
): Promise<SemanticSearchResult[]> {
  // 1. Generar embedding de la consulta
  const queryEmbedding = await generateEmbedding(query)

  // 2. Obtener todos los chunks de documentos activos de la empresa
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        companyId,
        status: 'ACTIVE',
      },
    },
    select: {
      content: true,
      embedding: true,
      document: { select: { name: true } },
    },
  })

  if (chunks.length === 0) return []

  // 3. Calcular similitud coseno con cada chunk
  const scored = chunks
    .map(chunk => ({
      content: chunk.content,
      documentName: chunk.document.name,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter(r => r.similarity > 0.3) // umbral mínimo de relevancia

  return scored
}

// Necesario para el tipo Prisma.InputJsonValue
import { Prisma } from '@prisma/client'
