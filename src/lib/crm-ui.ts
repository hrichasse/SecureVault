/**
 * crm-ui.ts — helpers de presentación del CRM (client-safe, sin Prisma).
 * Config de etapas del pipeline, colores del health score y formato CLP.
 */

export type CompanyStage = 'LEAD' | 'ONBOARDING' | 'ACTIVE' | 'AT_RISK' | 'CHURNED'

export interface StageMeta {
  label: string
  /** clases tailwind para columnas/badges del kanban */
  dot: string
  chip: string
}

export const STAGE_ORDER: CompanyStage[] = ['LEAD', 'ONBOARDING', 'ACTIVE', 'AT_RISK', 'CHURNED']

export const STAGE_CONFIG: Record<CompanyStage, StageMeta> = {
  LEAD:       { label: 'Prospecto',  dot: 'bg-sky-500',    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  ONBOARDING: { label: 'Onboarding', dot: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  ACTIVE:     { label: 'Activa',     dot: 'bg-emerald-500',chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  AT_RISK:    { label: 'En riesgo',  dot: 'bg-amber-500',  chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  CHURNED:    { label: 'Perdida',    dot: 'bg-rose-500',   chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
}

/** Devuelve color de texto/relleno para un health score 0-100. */
export function healthColor(score: number): { text: string; bar: string; ring: string } {
  if (score >= 75) return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'text-emerald-500' }
  if (score >= 50) return { text: 'text-lime-600 dark:text-lime-400', bar: 'bg-lime-500', ring: 'text-lime-500' }
  if (score >= 30) return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', ring: 'text-amber-500' }
  return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500', ring: 'text-rose-500' }
}

/** Formatea un monto CLP entero. */
export function formatClp(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

/**
 * Genera un enlace click-to-chat de WhatsApp (wa.me) a partir de un teléfono.
 * Limpia todo lo que no sea dígito. Devuelve null si no hay teléfono válido.
 */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
