/**
 * Embeddings Service — genera embeddings con Gemini y busca por similitud coseno.
 *
 * Usado por el sistema RAG del VaultAssistant para buscar contenido
 * relevante dentro de los documentos de la empresa.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types'

const EMBEDDING_MODEL = 'models/gemini-embedding-001'
const API_BASE = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}`

/** Tamaño objetivo de cada fragmento, en caracteres (~250 tokens). */
export const CHUNK_SIZE = 1000

/** Hasta cuántos textos se mandan en una sola llamada batchEmbedContents. */
const EMBED_BATCH = 50

/**
 * Tipo de tarea del embedding: el mismo modelo genera vectores mejor alineados
 * para búsqueda si se le indica qué es documento y qué es pregunta.
 */
export type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

// ── Llamada a la API (con reintento ante límites de cuota) ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callEmbeddingApi<T>(method: string, body: unknown): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API_BASE}:${method}`, {
      method: 'POST',
      // La key va en un header y no en la URL, para que no quede en logs de URLs
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (res.ok) return (await res.json()) as T

    const error = await res.json().catch(() => null)
    const message = error?.error?.message ?? res.statusText
    // 429 = cuota por minuto agotada; 5xx = falla temporal de Google: se reintenta
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= 4) {
      throw new Error(`Error generando embedding (${res.status}): ${message}`)
    }
    const waitMs = res.status === 429 ? 15_000 * attempt : 2_000 * attempt
    console.warn(`[Embeddings] ${res.status} (${message}); reintento ${attempt} en ${waitMs / 1000}s`)
    await sleep(waitMs)
  }
}

// ── Generar embeddings ──────────────────────────────────────

/** Embedding de un texto (se usa para la pregunta del usuario). */
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTask = 'RETRIEVAL_QUERY'
): Promise<number[]> {
  const data = await callEmbeddingApi<{ embedding: { values: number[] } }>('embedContent', {
    content: { parts: [{ text }] },
    taskType,
  })
  return data.embedding.values
}

/** Embeddings de varios textos, en lotes (una llamada a la API por lote). */
export async function generateEmbeddings(
  texts: string[],
  taskType: EmbeddingTask = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const data = await callEmbeddingApi<{ embeddings: { values: number[] }[] }>('batchEmbedContents', {
      requests: batch.map((text) => ({ model: EMBEDDING_MODEL, content: { parts: [{ text }] }, taskType })),
    })
    if (data.embeddings?.length !== batch.length) {
      throw new Error(`La API devolvió ${data.embeddings?.length ?? 0} embeddings para ${batch.length} textos`)
    }
    vectors.push(...data.embeddings.map((e) => e.values))
  }
  return vectors
}

// ── Similitud coseno entre dos vectores ─────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  // Vectores de distinto tamaño (indexados con otra configuración) no se comparan
  if (!Array.isArray(b) || a.length !== b.length) return 0
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

/** Corta un texto largo por palabras (último recurso, para oraciones enormes). */
function splitByWords(text: string, max: number): string[] {
  const out: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (word.length > max) {
      if (current) out.push(current)
      current = ''
      for (let i = 0; i < word.length; i += max) out.push(word.slice(i, i + max))
      continue
    }
    if (current && current.length + 1 + word.length > max) {
      out.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) out.push(current)
  return out
}

/** Corta un párrafo largo por oraciones, sin pasar de `max` caracteres. */
function splitBySentences(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]»]*|[^.!?]+$/g) ?? [text]
  const out: string[] = []
  let current = ''
  for (const raw of sentences) {
    const sentence = raw.trim()
    if (!sentence) continue
    if (sentence.length > max) {
      if (current) out.push(current)
      current = ''
      out.push(...splitByWords(sentence, max))
      continue
    }
    if (current && current.length + 1 + sentence.length > max) {
      out.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) out.push(current)
  return out
}

/**
 * Divide el texto de un PDF en fragmentos de hasta `maxChunkSize` caracteres.
 *
 * Respeta los párrafos (líneas en blanco) y agrupa varios cortos en un mismo
 * fragmento; un párrafo más largo que el máximo se corta por oraciones. Las
 * líneas sueltas dentro de un párrafo (el salto de línea de cada renglón del
 * PDF) se unen con un espacio.
 */
export function splitTextIntoChunks(text: string, maxChunkSize = CHUNK_SIZE): string[] {
  const clean = text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ') // espacios/tabs repetidos → un espacio (sin tocar los saltos)
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!clean) return []

  const pieces: string[] = []
  for (const paragraph of clean.split(/\n\n+/)) {
    const flat = paragraph.replace(/\n/g, ' ').trim()
    if (!flat) continue
    if (flat.length <= maxChunkSize) pieces.push(flat)
    else pieces.push(...splitBySentences(flat, maxChunkSize))
  }

  const chunks: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (current && current.length + 2 + piece.length > maxChunkSize) {
      chunks.push(current)
      current = piece
    } else {
      current = current ? `${current}\n\n${piece}` : piece
    }
  }
  if (current) chunks.push(current)

  return chunks.filter((c) => c.length > 20) // ignorar fragmentos muy cortos
}

// ── Indexar un documento (generar chunks + embeddings) ──────

/**
 * Indexa el texto de un documento para el RAG. Genera todos los embeddings
 * antes de tocar la BD y reemplaza los fragmentos anteriores en una sola
 * transacción: si algo falla, el documento conserva su índice previo.
 *
 * @returns cantidad de fragmentos indexados
 */
export async function indexDocument(documentId: string, text: string): Promise<number> {
  const chunks = splitTextIntoChunks(text)

  if (chunks.length === 0) {
    console.warn(`[Embeddings] Document ${documentId} has no extractable text.`)
    return 0
  }

  const vectors = await generateEmbeddings(chunks, 'RETRIEVAL_DOCUMENT')

  await prisma.$transaction([
    prisma.documentChunk.deleteMany({ where: { documentId } }),
    prisma.documentChunk.createMany({
      data: chunks.map((content, chunkIndex) => ({
        documentId,
        chunkIndex,
        content,
        embedding: vectors[chunkIndex] as unknown as Prisma.InputJsonValue,
      })),
    }),
  ])

  console.log(`[Embeddings] Indexed ${chunks.length} chunks for document ${documentId}`)
  return chunks.length
}

// ── Búsqueda semántica en los chunks de una empresa ─────────

export interface SemanticSearchResult {
  content: string
  documentName: string
  similarity: number
}

export interface SearchScope {
  companyId: string
  userId: string
  role: UserRole
}

/**
 * Documentos cuyo CONTENIDO puede leer el usuario: el asistente no debe citar
 * texto de un documento que el usuario no podría descargar.
 *  - ADMIN, ADMIN_COMPANY y NOTARY: todos los de su empresa (igual que hasActivePermission).
 *  - USER (trabajador): los que subió él y aquellos con un permiso de lectura vigente
 *    (solicitud de acceso aprobada y no vencida).
 */
export function readableDocumentsWhere({ companyId, userId, role }: SearchScope): Prisma.DocumentWhereInput {
  const base: Prisma.DocumentWhereInput = { companyId, status: 'ACTIVE' }
  if (role !== 'USER') return base
  return {
    ...base,
    OR: [
      { uploadedById: userId },
      {
        permissions: {
          some: {
            userId,
            canRead: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
    ],
  }
}

export async function semanticSearch(
  query: string,
  scope: SearchScope,
  topK = 5
): Promise<SemanticSearchResult[]> {
  // 1. Generar embedding de la consulta
  const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY')

  // 2. Obtener los chunks de los documentos que el usuario puede leer
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: readableDocumentsWhere(scope),
    },
    select: {
      content: true,
      embedding: true,
      document: { select: { name: true } },
    },
  })

  if (chunks.length === 0) return []

  // 3. Calcular similitud coseno con cada chunk
  return chunks
    .map((chunk) => ({
      content: chunk.content,
      documentName: chunk.document.name,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((r) => r.similarity > 0.3) // umbral mínimo de relevancia
}
