/**
 * Clasificador heurístico de confidencialidad para SecureVault AI.
 *
 * Analiza el nombre del archivo y descripción mediante reglas con pesos
 * para determinar el nivel de confidencialidad automáticamente.
 */

import type { ConfidentialityLevel } from '@/types'

// ── Reglas con pesos ───────────────────────────────────────────

const RULES: Array<{ terms: string[]; weight: number }> = [
  { terms: ['confidencial', 'secreto', 'restringido', 'clasificado'], weight: 4 },
  { terms: ['contrato', 'acuerdo', 'convenio', 'cláusula', 'clausula'], weight: 3 },
  { terms: ['financiero', 'balance', 'utilidades', 'presupuesto', 'factura'], weight: 3 },
  { terms: ['patente', 'propiedad intelectual', 'invención', 'invencion'], weight: 4 },
  { terms: ['rut', 'datos personales', 'cliente', 'identificación', 'identificacion'], weight: 2 },
  { terms: ['salario', 'remuneración', 'remuneracion', 'honorarios', 'nómina', 'nomina'], weight: 3 },
  { terms: ['estrategia', 'plan negocio', 'proyección', 'proyeccion', 'confidential'], weight: 2 },
  { terms: ['legal', 'demanda', 'sentencia', 'juicio'], weight: 3 },
]

// ── Tipos ────────────────────────────────────────────────────

export interface ClassificationResult {
  level: ConfidentialityLevel
  score: number
  matchedTerms: string[]
}

// ── Función principal ─────────────────────────────────────────

/**
 * Clasifica un documento según su nombre y descripción.
 *
 * @param filename - Nombre del archivo (con o sin extensión)
 * @param description - Descripción opcional del documento
 * @returns Nivel de confidencialidad, score y términos coincidentes
 */
export function classifyDocument(
  filename: string,
  description?: string
): ClassificationResult {
  // 1. Combinar texto en lowercase y eliminar extensión
  const baseName = filename.replace(/\.[^/.]+$/, '')
  const text = `${baseName} ${description ?? ''}`.toLowerCase()

  let score = 0
  const matchedTerms: string[] = []

  // 2. Aplicar reglas
  for (const rule of RULES) {
    for (const term of rule.terms) {
      if (text.includes(term)) {
        score += rule.weight
        matchedTerms.push(term)
        break // Solo contar la regla una vez aunque varios términos coincidan
      }
    }
  }

  // 3. Determinar nivel
  let level: ConfidentialityLevel
  if (score >= 8) level = 'CRITICO'
  else if (score >= 5) level = 'ALTO'
  else if (score >= 2) level = 'MEDIO'
  else level = 'BAJO'

  return { level, score, matchedTerms }
}
