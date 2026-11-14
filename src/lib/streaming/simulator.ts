/**
 * simulator.ts — Genera eventos de negocio realistas para la demo de streaming.
 *
 * Empresas, usuarios y documentos ficticios con la misma forma que los reales:
 * cada evento es lo que el sistema registraría si alguien usara la plataforma
 * (ver un contrato, pedir acceso, reportar un incidente...). Los tipos más
 * frecuentes pesan más, como en la realidad (se ven documentos mucho más de lo
 * que se suben).
 *
 * burst() simula un comportamiento sospechoso: un mismo usuario descarga muchos
 * documentos ALTO/CRÍTICO en pocos segundos. Sirve para mostrar en vivo la
 * alerta de EXFILTRACION del consumidor de métricas.
 *
 * Pura y determinista si se le pasa `random`: así se testea.
 */
import { randomUUID } from 'crypto'
import { createBusinessEvent, type BusinessEvent, type BusinessEventType, type ConfidentialityLevel } from './events'

interface DemoDocument {
  id: string
  name: string
  level: ConfidentialityLevel
}

interface DemoCompany {
  id: string
  name: string
  users: { id: string; name: string }[]
  documents: DemoDocument[]
}

const doc = (id: string, name: string, level: ConfidentialityLevel): DemoDocument => ({ id, name, level })

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    id: 'demo-austral',
    name: 'Banco Austral (demo)',
    users: [
      { id: 'demo-u-01', name: 'Camila Rojas' },
      { id: 'demo-u-02', name: 'Matías Soto' },
      { id: 'demo-u-03', name: 'Valentina Díaz' },
    ],
    documents: [
      doc('demo-d-01', 'Balance consolidado 2026', 'CRITICO'),
      doc('demo-d-02', 'Contrato de arriendo sucursal centro', 'ALTO'),
      doc('demo-d-03', 'Remuneraciones octubre', 'ALTO'),
      doc('demo-d-04', 'Política de vacaciones', 'BAJO'),
      doc('demo-d-05', 'Presupuesto TI 2027', 'MEDIO'),
    ],
  },
  {
    id: 'demo-andes',
    name: 'Clínica Andes (demo)',
    users: [
      { id: 'demo-u-04', name: 'Diego Muñoz' },
      { id: 'demo-u-05', name: 'Fernanda Castro' },
      { id: 'demo-u-06', name: 'Joaquín Herrera' },
    ],
    documents: [
      doc('demo-d-06', 'Fichas clínicas convenio', 'CRITICO'),
      doc('demo-d-07', 'Acuerdo de confidencialidad proveedores', 'ALTO'),
      doc('demo-d-08', 'Protocolo de atención', 'BAJO'),
      doc('demo-d-09', 'Licitación equipos médicos', 'MEDIO'),
      doc('demo-d-10', 'Demanda laboral 2026', 'ALTO'),
    ],
  },
  {
    id: 'demo-pacifico',
    name: 'Constructora Pacífico (demo)',
    users: [
      { id: 'demo-u-07', name: 'Ignacio Vargas' },
      { id: 'demo-u-08', name: 'Antonia Reyes' },
    ],
    documents: [
      doc('demo-d-11', 'Planos edificio Las Condes', 'ALTO'),
      doc('demo-d-12', 'Contrato subcontratistas', 'MEDIO'),
      doc('demo-d-13', 'Manual de seguridad en obra', 'BAJO'),
      doc('demo-d-14', 'Estrategia comercial 2027', 'CRITICO'),
    ],
  },
  {
    id: 'demo-norte',
    name: 'Retail Norte (demo)',
    users: [
      { id: 'demo-u-09', name: 'Sofía Fuentes' },
      { id: 'demo-u-10', name: 'Benjamín Pérez' },
      { id: 'demo-u-11', name: 'Isidora Morales' },
    ],
    documents: [
      doc('demo-d-15', 'Facturas proveedores Q3', 'MEDIO'),
      doc('demo-d-16', 'Base de datos clientes', 'CRITICO'),
      doc('demo-d-17', 'Catálogo temporada verano', 'BAJO'),
      doc('demo-d-18', 'Proyección de ventas', 'ALTO'),
    ],
  },
]

/** Frecuencia relativa de cada tipo de evento */
const WEIGHTS: [BusinessEventType, number][] = [
  ['VIEW_DOCUMENT', 40],
  ['LOGIN', 14],
  ['UPLOAD_DOCUMENT', 12],
  ['REQUEST_ACCESS', 9],
  ['APPROVE_REQUEST', 6],
  ['VERIFY_DOCUMENT', 4],
  ['CERTIFY_DOCUMENT', 4],
  ['REJECT_REQUEST', 3],
  ['CREATE_INCIDENT', 3],
  ['LOGOUT', 3],
  ['CLOSE_INCIDENT', 2],
]

const WITHOUT_DOCUMENT: BusinessEventType[] = ['LOGIN', 'LOGOUT']

/** Prioridad del incidente según el nivel del documento (igual que incident.service) */
const PRIORITY_BY_LEVEL = { BAJO: 'LOW', MEDIO: 'MEDIUM', ALTO: 'HIGH', CRITICO: 'CRITICAL' } as const

export interface Simulator {
  /** Un evento aleatorio, con el peso de cada tipo */
  next(now?: Date): BusinessEvent
  /** Ráfaga sospechosa: un usuario descarga muchos documentos sensibles seguidos */
  burst(size?: number, now?: Date): BusinessEvent[]
}

export function createSimulator(random: () => number = Math.random): Simulator {
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]

  const totalWeight = WEIGHTS.reduce((sum, [, w]) => sum + w, 0)
  const pickType = (): BusinessEventType => {
    let r = random() * totalWeight
    for (const [type, w] of WEIGHTS) {
      if ((r -= w) < 0) return type
    }
    return WEIGHTS[0][0]
  }

  return {
    next(now = new Date()) {
      const company = pick(DEMO_COMPANIES)
      const user = pick(company.users)
      const type = pickType()
      const document = WITHOUT_DOCUMENT.includes(type) ? null : pick(company.documents)
      return createBusinessEvent({
        id: randomUUID(),
        type,
        occurredAt: now.toISOString(),
        source: 'simulator',
        companyId: company.id,
        companyName: company.name,
        userId: user.id,
        userName: user.name,
        documentId: document?.id ?? null,
        documentName: document?.name,
        confidentialityLevel: document?.level ?? null,
        priority: type === 'CREATE_INCIDENT' && document ? PRIORITY_BY_LEVEL[document.level] : null,
      })
    },

    burst(size = 8, now = new Date()) {
      const company = pick(DEMO_COMPANIES)
      const user = pick(company.users)
      const sensitive = company.documents.filter((d) => d.level === 'ALTO' || d.level === 'CRITICO')
      return Array.from({ length: size }, (_, i) => {
        const document = sensitive[i % sensitive.length]
        return createBusinessEvent({
          id: randomUUID(),
          type: 'VIEW_DOCUMENT',
          occurredAt: new Date(now.getTime() + i * 250).toISOString(),
          source: 'simulator',
          companyId: company.id,
          companyName: company.name,
          userId: user.id,
          userName: user.name,
          documentId: document.id,
          documentName: document.name,
          confidentialityLevel: document.level,
        })
      })
    },
  }
}
