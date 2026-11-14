-- RAG con pgvector: la similitud se calcula en la BD y solo viajan a la app los
-- fragmentos más cercanos (antes se leían todos los vectores en cada pregunta).

-- La tabla DocumentChunk se creó fuera de las migraciones (db push). Se declara
-- aquí con IF NOT EXISTS para que una base nueva quede igual que producción;
-- donde ya existe, estos pasos no hacen nada.
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentChunk_documentId_fkey') THEN
    ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS en modo deny-all, igual que el resto de las tablas (solo accede el backend)
ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;

-- pgvector. Supabase instala las extensiones en el esquema "extensions",
-- que ya está en el search_path de la conexión.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Vector de 768 dimensiones (gemini-embedding-001 con outputDimensionality 768).
-- La columna "embedding" (JSON) queda como legado: el código nuevo guarda '[]' y
-- el anterior ignora esos vectores vacíos, así ambas versiones conviven.
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "embeddingVector" extensions.vector(768);
