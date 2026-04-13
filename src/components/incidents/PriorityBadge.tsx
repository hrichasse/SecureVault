import type { IncidentPriority } from '@/types'

const PRIORITY_CONFIG: Record<
  IncidentPriority,
  { label: string; className: string; dot: string }
> = {
  LOW: {
    label: 'BAJA',
    className: 'bg-[#64748b]/15 text-[#94a3b8] border border-[#64748b]/30',
    dot: 'bg-[#94a3b8]',
  },
  MEDIUM: {
    label: 'MEDIA',
    className: 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30',
    dot: 'bg-[#f59e0b]',
  },
  HIGH: {
    label: 'ALTA',
    className: 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30',
    dot: 'bg-[#f97316]',
  },
  CRITICAL: {
    label: 'CRÍTICA',
    className: 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30',
    dot: 'bg-[#ef4444]',
  },
}

export function PriorityBadge({ priority, size = 'sm' }: { priority: IncidentPriority; size?: 'sm' | 'md' }) {
  const config = PRIORITY_CONFIG[priority]
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  )
}
