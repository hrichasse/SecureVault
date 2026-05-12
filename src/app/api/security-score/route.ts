import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export interface SecurityFactor {
  id: string
  label: string
  points: number
  type: 'positive' | 'negative' | 'neutral'
}

export interface SecurityScoreResponse {
  score: number
  factors: SecurityFactor[]
  lastCalculated: string
}

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = user.companyId
    let score = 100
    const factors: SecurityFactor[] = []

    // 1. Verificar plan de suscripción
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
    })

    if (!subscription || subscription.plan === 'FREE') {
      score -= 20
      factors.push({
        id: 'plan_free',
        label: 'Plan Gratuito activo (Falta encriptación avanzada)',
        points: -20,
        type: 'negative',
      })
    } else {
      factors.push({
        id: 'plan_pro_enterprise',
        label: `Plan ${subscription.plan} activo`,
        points: 0, // Base is 100, we just don't deduct, or we can say it's a positive factor that keeps the score high
        type: 'positive',
      })
    }

    // 2. Incidentes Críticos/Altos abiertos
    const openIncidentsCount = await prisma.incident.count({
      where: {
        companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        priority: { in: ['CRITICAL', 'HIGH'] },
      },
    })

    if (openIncidentsCount > 0) {
      const penalty = Math.min(openIncidentsCount * 15, 45) // Max penalty 45
      score -= penalty
      factors.push({
        id: 'open_incidents',
        label: `${openIncidentsCount} incidente(s) grave(s) sin resolver`,
        points: -penalty,
        type: 'negative',
      })
    } else {
      factors.push({
        id: 'no_incidents',
        label: 'Sin incidentes graves pendientes',
        points: 0,
        type: 'positive',
      })
    }

    // 3. Solicitudes de acceso pendientes antiguas (más de 3 días)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const staleRequestsCount = await prisma.accessRequest.count({
      where: {
        document: { companyId },
        status: 'PENDING',
        createdAt: { lt: threeDaysAgo },
      },
    })

    if (staleRequestsCount > 0) {
      const penalty = Math.min(staleRequestsCount * 5, 20) // Max penalty 20
      score -= penalty
      factors.push({
        id: 'stale_requests',
        label: `${staleRequestsCount} solicitud(es) de acceso expiradas/retrasadas`,
        points: -penalty,
        type: 'negative',
      })
    }

    // 4. Uso de certificaciones notariales (Bono)
    // Buscamos si la empresa tiene documentos certificados
    const certifiedDocsCount = await prisma.certification.count({
      where: {
        document: { companyId },
        isValid: true,
      },
    })

    if (certifiedDocsCount > 0) {
      const bonus = 10
      score = Math.min(score + bonus, 100) // Cap at 100
      factors.push({
        id: 'certifications_used',
        label: 'Uso activo de certificaciones notariales',
        points: bonus,
        type: 'positive',
      })
    } else {
      factors.push({
        id: 'no_certifications',
        label: 'Aún no se certifican documentos',
        points: 0,
        type: 'neutral',
      })
    }

    // Ensure score doesn't go below 0
    score = Math.max(score, 0)

    return NextResponse.json({
      data: {
        score,
        factors,
        lastCalculated: new Date().toISOString(),
      }
    }, { status: 200 })

  } catch (error) {
    console.error('[GET /api/security-score] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
