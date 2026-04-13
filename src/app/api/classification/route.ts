import { NextResponse } from 'next/server'
import { z } from 'zod'
import { classifyDocument } from '@/modules/classification/classifier'

const schema = z.object({
  filename: z.string().min(1),
  description: z.string().optional(),
})

/**
 * POST /api/classification
 *
 * Clasifica texto de forma síncrona sin subir ningún archivo.
 * Útil para preview de clasificación antes del upload.
 *
 * Body: { filename: string, description?: string }
 * Returns: { level, score, matchedTerms }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Se requiere filename' },
        { status: 400 }
      )
    }

    const result = classifyDocument(parsed.data.filename, parsed.data.description)
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/classification]', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
