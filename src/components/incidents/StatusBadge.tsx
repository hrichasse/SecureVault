import type { IncidentStatus } from '@/types'

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: 'Abierto',
    className: 'bg-[#ef4444]/15 text-[#ef4444]',
  },
  IN_PROGRESS: {
    label: 'En curso',
    className: 'bg-[#3b82f6]/15 text-[#3b82f6]',
  },
  RESOLVED: {
    label: 'Resuelto',
    className: 'bg-[#10b981]/15 text-[#10b981]',
  },
  CLOSED: {
    label: 'Cerrado',
    className: 'bg-[#64748b]/15 text-[#64748b]',
  },
}

export function StatusBadge({ status, size = 'md' }: { status: IncidentStatus; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status]
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2py-1'

  return (
    <span className={`inline-flex items-center rounded-md font-medium ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  )
}
