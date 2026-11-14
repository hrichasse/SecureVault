/**
 * @jest-environment node
 */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  splitTextIntoChunks,
  readableDocumentsWhere,
  toVectorLiteral,
  CHUNK_SIZE,
  EMBEDDING_DIMENSIONS,
} from '@/lib/embeddings'

describe('toVectorLiteral (formato de pgvector)', () => {
  it('convierte el vector al texto que entiende pgvector', () => {
    const v = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 0.5 : i === 1 ? -0.25 : 0))
    expect(toVectorLiteral(v).startsWith('[0.5,-0.25,0,')).toBe(true)
  })

  it('rechaza vectores de otro tamaño o con valores inválidos', () => {
    expect(() => toVectorLiteral([0.1, 0.2])).toThrow(/dimensiones/)
    const bad = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0)
    bad[3] = NaN
    expect(() => toVectorLiteral(bad)).toThrow(/no numéricos/)
  })
})

const sentence = 'Este es un texto de prueba que simula una oración de un documento real. '

describe('splitTextIntoChunks', () => {
  it('divide un documento largo en varios fragmentos (antes quedaba en uno solo)', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Sección ${i + 1}. ${sentence.repeat(4)}`).join('\n\n')
    const chunks = splitTextIntoChunks(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(CHUNK_SIZE)
  })

  it('corta por oraciones el texto de un PDF que viene con un salto por renglón', () => {
    // Así entrega pdf-parse muchos PDFs: sin líneas en blanco entre párrafos
    const text = Array.from({ length: 80 }, () => 'línea del pdf con algunas palabras y un punto.').join('\n')
    const chunks = splitTextIntoChunks(text, 300)
    expect(chunks.length).toBeGreaterThan(5)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300)
    expect(chunks[0]).not.toContain('\n') // los renglones se unen con espacios
  })

  it('no pierde texto al dividir', () => {
    const text = sentence.repeat(60)
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length
    const chunks = splitTextIntoChunks(text, 200)
    expect(chunks.reduce((n, c) => n + words(c), 0)).toBe(words(text))
  })

  it('una "palabra" gigante (sin espacios) también se corta', () => {
    const chunks = splitTextIntoChunks('x'.repeat(2500), 1000)
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500])
  })

  it('texto vacío o muy corto no genera fragmentos', () => {
    expect(splitTextIntoChunks('   \n\n  ')).toEqual([])
    expect(splitTextIntoChunks('hola')).toEqual([])
  })
})

describe('readableDocumentsWhere (permisos del RAG)', () => {
  it('admin de empresa, admin y notario ven todos los documentos de su empresa', () => {
    for (const role of ['ADMIN', 'ADMIN_COMPANY', 'NOTARY'] as const) {
      expect(readableDocumentsWhere({ companyId: 'c1', userId: 'u1', role })).toEqual({
        companyId: 'c1',
        status: 'ACTIVE',
      })
    }
  })

  it('un trabajador solo ve lo que subió o aquello con permiso vigente', () => {
    const where = readableDocumentsWhere({ companyId: 'c1', userId: 'u1', role: 'USER' })
    expect(where.companyId).toBe('c1')
    expect(where.OR).toEqual([
      { uploadedById: 'u1' },
      {
        permissions: {
          some: {
            userId: 'u1',
            canRead: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
          },
        },
      },
    ])
  })
})
