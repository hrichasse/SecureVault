/**
 * Indexa para el RAG los documentos activos de TODAS las empresas.
 *
 *   npx tsx scripts/index-documents.ts            → solo los que no tienen fragmentos
 *   npx tsx scripts/index-documents.ts --reindex  → todos (tras cambiar el troceo o el modelo)
 *
 * Usa las credenciales de .env / .env.local (DATABASE_URL, Supabase y GEMINI_API_KEY)
 * y el mismo camino que el indexador del bus (indexDocumentFromStorage).
 */

// Cargar el entorno ANTES de importar módulos que lo leen (un `import` se
// ejecutaría antes; por eso require). El cliente de Supabase lee el entorno al importarse.
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
/* eslint-enable @typescript-eslint/no-require-imports */

import { prisma } from '../src/lib/prisma'
import { indexDocumentFromStorage } from '../src/modules/documents/indexing.service'

async function main() {
  const reindex = process.argv.includes('--reindex')
  console.log(reindex ? '🔁 Reindexando todos los documentos activos...\n' : '🔍 Buscando documentos sin indexar...\n')

  const documents = await prisma.document.findMany({
    where: { status: 'ACTIVE', ...(reindex ? {} : { chunks: { none: {} } }) },
    select: { id: true, name: true, company: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📄 ${documents.length} documento(s) para indexar.\n`)
  if (documents.length === 0) return

  let totalChunks = 0
  let failed = 0

  for (const doc of documents) {
    process.stdout.write(`  ⏳ "${doc.name}" (${doc.company.name})... `)
    try {
      const outcome = await indexDocumentFromStorage(doc.id)
      if (outcome.status === 'indexed') {
        totalChunks += outcome.chunks
        console.log(`✅ ${outcome.chunks} fragmentos`)
      } else {
        console.log(`⚠️  omitido (${outcome.reason === 'no-text' ? 'sin texto: ¿PDF escaneado?' : outcome.reason})`)
      }
    } catch (err) {
      failed++
      console.log(`❌ ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n🎉 Listo: ${totalChunks} fragmentos creados${failed ? `, ${failed} documento(s) con error` : ''}.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
