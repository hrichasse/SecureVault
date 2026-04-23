import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/modules/auth/auth.service'
import { prisma } from '@/lib/prisma'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UserContext {
  userId: string
  companyId: string
  companyName: string
  userName: string
  role: string
}

// ─── Contexto de datos desde la BD ────────────────────────────────────────────

async function fetchUserDataContext(ctx: UserContext): Promise<string> {
  try {
    const [docCount, incidentCount, pendingRequests, recentDocs, openIncidents] =
      await Promise.all([
        // Total documentos activos de la empresa
        prisma.document.count({
          where: { companyId: ctx.companyId, status: 'ACTIVE' },
        }),
        // Total incidentes de la empresa
        prisma.incident.count({
          where: { companyId: ctx.companyId },
        }),
        // Solicitudes de acceso pendientes del usuario
        prisma.accessRequest.count({
          where: { requestedById: ctx.userId, status: 'PENDING' },
        }),
        // Últimos 8 documentos activos con metadata
        prisma.document.findMany({
          where: { companyId: ctx.companyId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            originalName: true,
            confidentialityLevel: true,
            classificationScore: true,
            description: true,
            createdAt: true,
            uploadedBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        // Incidentes abiertos
        prisma.incident.findMany({
          where: {
            companyId: ctx.companyId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

    const docsText = recentDocs
      .map(
        (d) =>
          `- "${d.name}" | Nivel: ${d.confidentialityLevel} | Subido por: ${d.uploadedBy.name} | Fecha: ${d.createdAt.toLocaleDateString('es-CL')}${d.description ? ` | Descripción: ${d.description}` : ''}`
      )
      .join('\n')

    const incidentsText = openIncidents
      .map(
        (i) =>
          `- "${i.title}" | Tipo: ${i.type} | Prioridad: ${i.priority} | Estado: ${i.status}`
      )
      .join('\n')

    return `
DATOS REALES DEL SISTEMA (empresa: ${ctx.companyName}):
- Total documentos activos: ${docCount}
- Total incidentes registrados: ${incidentCount}
- Solicitudes de acceso pendientes del usuario: ${pendingRequests}
- Incidentes abiertos: ${openIncidents.length}

DOCUMENTOS RECIENTES (${recentDocs.length} últimos):
${docsText || 'No hay documentos registrados aún.'}

INCIDENTES ABIERTOS:
${incidentsText || 'No hay incidentes abiertos.'}
`.trim()
  } catch (err) {
    console.error('Error fetching user data context:', err)
    return 'No se pudo obtener el contexto de datos del sistema.'
  }
}

// ─── Búsqueda dinámica de documentos ──────────────────────────────────────────

async function searchDocuments(
  companyId: string,
  query: string
): Promise<string> {
  try {
    // Buscar en nombre, descripción y nombre original
    const docs = await prisma.document.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { originalName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        name: true,
        originalName: true,
        confidentialityLevel: true,
        description: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      take: 10,
    })

    if (docs.length === 0) return ''

    return (
      `RESULTADOS DE BÚSQUEDA para "${query}":\n` +
      docs
        .map(
          (d) =>
            `- "${d.name}" | Nivel: ${d.confidentialityLevel} | Autor: ${d.uploadedBy.name} | Fecha: ${d.createdAt.toLocaleDateString('es-CL')}${d.description ? ` | ${d.description}` : ''}`
        )
        .join('\n')
    )
  } catch {
    return ''
  }
}

// ─── Detectar si el mensaje necesita búsqueda extra ───────────────────────────

function detectsSearchIntent(message: string): string | null {
  const lower = message.toLowerCase()
  const searchKeywords = [
    'busca', 'buscar', 'encuentra', 'encontrar', 'contrato', 'documento',
    'archivo', 'pdf', 'informe', 'reporte', 'acuerdo', 'nombre', 'quién',
    'cuál', 'que documentos', 'hay algún', 'tengo', 'existe',
  ]
  for (const kw of searchKeywords) {
    if (lower.includes(kw)) {
      // Extraer término de búsqueda principal (palabras clave del mensaje)
      const words = message
        .split(' ')
        .filter((w) => w.length > 4 && !['tengo', 'puedo', 'puede', 'hacer', 'cuales', 'existe', 'busca', 'buscar', 'documentos'].includes(w.toLowerCase()))
      return words.slice(0, 3).join(' ')
    }
  }
  return null
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(userCtx: UserContext, dataCtx: string): string {
  return `Eres "Vault", el asistente inteligente de SecureVault AI.
Estás hablando con ${userCtx.userName}, quien tiene rol "${userCtx.role}" en la empresa "${userCtx.companyName}".

ACCESO A DATOS REALES:
Tienes acceso a los datos reales del sistema de este usuario. Úsalos para responder preguntas sobre documentos, incidentes o solicitudes de forma precisa.

${dataCtx}

NAVEGACIÓN:
- Dashboard: /dashboard
- Documentos: /documents (subir, ver, gestionar)
- Solicitudes: /requests (pedir o aprobar acceso)
- Incidentes: /incidents (reportar y gestionar)
- Certificaciones: /certifications (solo Notarios)
- Auditoría: /audit (historial de acciones)
- Administración: /admin (solo Admins)
- Configuración: /settings

REGLAS:
- Responde siempre en español.
- Sé preciso con los datos del sistema cuando el usuario pregunte por documentos o incidentes reales.
- Cuando menciones datos del sistema, cítalos con exactitud (nombres, niveles, fechas).
- Sé breve: máximo 4-5 oraciones. Usa listas cuando sean 2+ items.
- Si no encuentras algo en los datos, díselo honestamente.
- Usa emojis con moderación para ser amigable.`
}

// ─── Fallback inteligente (cuando Gemini no está disponible) ─────────────────

function buildSmartFallback(message: string, dataCtx: string, userCtx: UserContext): string {
  const lower = message.toLowerCase()

  // Extraer números del contexto de datos
  const docMatch = dataCtx.match(/Total documentos activos: (\d+)/)
  const incMatch = dataCtx.match(/Total incidentes registrados: (\d+)/)
  const pendMatch = dataCtx.match(/Solicitudes de acceso pendientes del usuario: (\d+)/)
  const openMatch = dataCtx.match(/Incidentes abiertos: (\d+)/)

  const docCount = docMatch?.[1] ?? '?'
  const incCount = incMatch?.[1] ?? '?'
  const pendCount = pendMatch?.[1] ?? '?'
  const openCount = openMatch?.[1] ?? '?'

  // Extraer lista de documentos del contexto
  const docsSection = dataCtx.split('DOCUMENTOS RECIENTES')[1]?.split('INCIDENTES')[0] ?? ''
  const incSection = dataCtx.split('INCIDENTES ABIERTOS:')[1] ?? ''
  const searchSection = dataCtx.split('RESULTADOS DE BÚSQUEDA')[1] ?? ''

  if (lower.includes('cuántos') || lower.includes('cuantos') || lower.includes('total') || lower.includes('estadística')) {
    return `📊 Resumen de **${userCtx.companyName}**:\n- 📄 Documentos activos: **${docCount}**\n- 🚨 Incidentes totales: **${incCount}** (${openCount} abiertos)\n- ⏳ Tus solicitudes pendientes: **${pendCount}**`
  }

  if (lower.includes('documento') || lower.includes('archivo') || lower.includes('busca') || lower.includes('contrato') || lower.includes('informe')) {
    if (searchSection) {
      return `🔍 Encontré los siguientes resultados:\n${searchSection.trim().slice(0, 400)}`
    }
    if (docsSection.trim()) {
      return `📄 Tienes **${docCount}** documentos activos. Aquí los más recientes:\n${docsSection.trim().slice(0, 400)}\n\nPuedes verlos todos en [/documents].`
    }
    return `📄 Tu empresa tiene **${docCount}** documentos activos. Ve a [/documents] para verlos y filtrarlos.`
  }

  if (lower.includes('incidente') || lower.includes('seguridad') || lower.includes('problema')) {
    if (incSection.trim() && incSection.trim() !== 'No hay incidentes abiertos.') {
      return `🚨 Hay **${openCount}** incidentes abiertos:\n${incSection.trim().slice(0, 400)}`
    }
    return `✅ No hay incidentes abiertos actualmente. Total registrados: **${incCount}**. Ve a [/incidents] para más detalles.`
  }

  if (lower.includes('solicitud') || lower.includes('acceso') || lower.includes('pendiente')) {
    return `⏳ Tienes **${pendCount}** solicitudes de acceso pendientes. Ve a [/requests] para revisarlas o crear nuevas.`
  }

  if (lower.includes('subir') || lower.includes('cargar') || lower.includes('upload')) {
    return `📤 Para subir un documento: ve a **Documentos** (/documents) y haz clic en el botón **"Subir documento"**. El sistema lo clasificará automáticamente con IA (niveles: BAJO, MEDIO, ALTO, CRÍTICO).`
  }

  if (lower.includes('solicitar') || lower.includes('pedir') || lower.includes('request')) {
    return `📋 Para solicitar acceso a un documento: ve a **Solicitudes** (/requests) → "Nueva solicitud", selecciona el documento e indica el motivo.`
  }

  if (lower.includes('reportar') || lower.includes('incidente') || lower.includes('problema')) {
    return `🚨 Para reportar un incidente: ve a **Incidentes** (/incidents) y haz clic en **"Reportar incidente"**.`
  }

  if (lower.includes('auditoría') || lower.includes('historial') || lower.includes('log')) {
    return `📋 El historial completo de acciones está en **Auditoría** (/audit). Puedes filtrar por fecha, usuario y tipo de acción, y exportar a CSV.`
  }

  if (lower.includes('hola') || lower.includes('buenos') || lower.includes('ayuda')) {
    return `👋 ¡Hola, ${userCtx.userName}! Soy Vault, tu asistente de SecureVault AI 🔐\n\nActualmente en **${userCtx.companyName}** tienes:\n- 📄 ${docCount} documentos activos\n- 🚨 ${openCount} incidentes abiertos\n- ⏳ ${pendCount} solicitudes pendientes\n\n¿En qué te puedo ayudar?`
  }

  return `Puedo ayudarte con información sobre tus documentos (${docCount} activos), incidentes (${openCount} abiertos), solicitudes de acceso (${pendCount} pendientes) o cómo navegar el sistema. ¿Qué necesitas? 🔐`
}

// ─── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API key no configurada. Agrega GEMINI_API_KEY en .env.local' },
        { status: 500 }
      )
    }

    // 1. Autenticar usuario
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para usar el asistente.' },
        { status: 401 }
      )
    }

    const userCtx: UserContext = {
      userId: authUser.id,
      companyId: authUser.companyId,
      companyName: authUser.company.name,
      userName: authUser.name,
      role: authUser.role,
    }

    // 2. Leer mensajes del cuerpo
    const { messages } = (await req.json()) as { messages: ChatMessage[] }
    if (!messages?.length) {
      return NextResponse.json({ error: 'Mensajes inválidos' }, { status: 400 })
    }

    const lastUserMessage = messages[messages.length - 1]?.content ?? ''

    // 3. Obtener contexto de datos + búsqueda adicional si aplica
    const [dataCtx, searchCtx] = await Promise.all([
      fetchUserDataContext(userCtx),
      (async () => {
        const searchTerm = detectsSearchIntent(lastUserMessage)
        if (searchTerm) {
          return await searchDocuments(userCtx.companyId, searchTerm)
        }
        return ''
      })(),
    ])

    const fullDataCtx = searchCtx
      ? `${dataCtx}\n\n${searchCtx}`
      : dataCtx

    // 4. Construir conversación para Gemini
    const geminiContents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // 5. Llamar a Gemini con fallback inteligente
    let responseText = ''

    try {
      const body = {
        system_instruction: {
          parts: [{ text: buildSystemPrompt(userCtx, fullDataCtx) }],
        },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 400,
          topP: 0.9,
        },
      }

      const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await geminiRes.json()

      if (geminiRes.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = data.candidates[0].content.parts[0].text
      } else {
        console.warn('Gemini unavailable, using smart fallback:', data?.error?.message)
        responseText = buildSmartFallback(lastUserMessage, fullDataCtx, userCtx)
      }
    } catch {
      responseText = buildSmartFallback(lastUserMessage, fullDataCtx, userCtx)
    }

    return NextResponse.json({ message: responseText })
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
