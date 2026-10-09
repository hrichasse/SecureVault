/**
 * Indexing Service — indexa un documento para RAG a partir de su PDF en Storage.
 *
 * Lo ejecuta el consumidor "indexer" del bus de mensajes. El mensaje trae solo
 * el id del documento; aquí se relee el PDF desde Supabase Storage.
 *
 * Es idempotente (indexDocument borra los chunks previos antes de insertar), lo
 * que permite que el broker lo reintente sin duplicar datos.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { indexDocument, splitTextIntoChunks } from '@/lib/embeddings'
import { PermanentError } from '@/lib/messaging/settlement'

const BUCKET = 'documents'
const MIN_TEXT_LENGTH = 50

export type IndexingOutcome =
  | { status: 'indexed'; chunks: number }
  | { status: 'skipped'; reason: 'deleted' | 'no-text' }

/**
 * @throws PermanentError si el PDF no se puede leer (reintentar no lo arregla).
 * @throws Error ante fallos transitorios (Storage, embeddings): el mensaje se reintenta.
 */
export async function indexDocumentFromStorage(documentId: string): Promise<IndexingOutcome> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, storagePath: true, status: true },
  })
  // El documento pudo eliminarse entre la publicación y el consumo: nada que indexar.
  if (!doc || doc.status === 'DELETED') return { status: 'skipped', reason: 'deleted' }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(doc.storagePath)
  if (downloadError || !file) {
    throw new Error(`No se pudo descargar el PDF desde Storage: ${downloadError?.message ?? 'respuesta vacía'}`)
  }

  // Se importa el módulo interno y no 'pdf-parse': empaquetado por webpack, su
  // index.js cree estar en modo debug e intenta leer un PDF de prueba que no
  // existe, así que en el build de producción fallaba siempre con ENOENT.
  // @ts-expect-error — pdf-parse v1 no trae tipos (CommonJS, export por defecto)
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  // Se pasa un Uint8Array y no un Buffer: el pdf.js que usa pdf-parse clona la
  // entrada, y los Buffer de menos de 4 KB salen del pool compartido de Node con
  // un offset que ese pdf.js no respeta, así que leía basura de forma intermitente.
  const bytes = new Uint8Array(await file.arrayBuffer())

  let text: string
  try {
    const parsed = await pdfParse(bytes)
    text = parsed.text ?? ''
  } catch (err) {
    throw new PermanentError(
      'PdfUnparseable',
      `El PDF no se pudo leer: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // PDF escaneado o sin texto: no es un error, simplemente no hay qué indexar.
  if (text.trim().length <= MIN_TEXT_LENGTH) return { status: 'skipped', reason: 'no-text' }

  // indexDocument tolera fallos por fragmento y devuelve cuántos indexó. Una
  // indexación incompleta se trata como fallo para que el mensaje se reintente.
  const expected = splitTextIntoChunks(text).length
  const indexed = await indexDocument(documentId, text)
  if (indexed < expected) {
    throw new Error(`Indexación incompleta: ${indexed} de ${expected} fragmentos con embedding`)
  }

  return { status: 'indexed', chunks: indexed }
}
