/**
 * Script para indexar todos los documentos existentes para RAG.
 * Ejecutar con: npx tsx scripts/index-documents.ts
 */

// Load env FIRST before any imports that use env vars
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

import { prisma } from '../src/lib/prisma'
import { supabaseAdmin } from '../src/lib/supabase/admin'
import { indexDocument } from '../src/lib/embeddings'

const BUCKET = 'documents'

async function main() {
  console.log('🔍 Buscando documentos sin indexar...\n')

  const documents = await prisma.document.findMany({
    where: {
      status: 'ACTIVE',
      chunks: { none: {} },
    },
    select: {
      id: true,
      name: true,
      storagePath: true,
      company: { select: { name: true } },
    },
  })

  console.log(`📄 Encontrados ${documents.length} documentos para indexar.\n`)

  if (documents.length === 0) {
    console.log('✅ Todos los documentos ya están indexados.')
    return
  }

  let totalChunks = 0

  for (const doc of documents) {
    try {
      console.log(`  ⏳ Procesando: "${doc.name}" (${doc.company.name})...`)

      // Descargar PDF
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from(BUCKET)
        .download(doc.storagePath)

      if (dlError || !fileData) {
        console.log(`    ❌ No se pudo descargar: ${dlError?.message}`)
        continue
      }

      // Extraer texto
      const buffer = Buffer.from(await fileData.arrayBuffer())
      // @ts-ignore — pdf-parse v1 uses CommonJS default export
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)

      if (!parsed.text || parsed.text.trim().length < 50) {
        console.log(`    ⚠️  Sin texto extraíble (${parsed.text?.length ?? 0} chars)`)
        continue
      }

      console.log(`    📝 Texto extraído: ${parsed.text.length} caracteres`)

      // Indexar
      const chunksCreated = await indexDocument(doc.id, parsed.text)
      totalChunks += chunksCreated
      console.log(`    ✅ ${chunksCreated} chunks creados`)

      // Pausa para respetar rate limits de Gemini
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.log(`    ❌ Error: ${err}`)
    }
  }

  console.log(`\n🎉 Indexación completada. Total: ${totalChunks} chunks creados.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
