import type { ConfidentialityLevel } from '@/types'

interface ConfidentialityBadgeProps {
  level: ConfidentialityLevel
  showIcon?: boolean
  size?: 'sm' | 'md'
}

const LEVEL_CONFIG: Record<
  ConfidentialityLevel,
  { label: string; className: string; dot: string }
> = {
  BAJO: {
    label: 'BAJO',
    className:
      'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30',
    dot: 'bg-[#10b981]',
  },
  MEDIO: {
    label: 'MEDIO',
    className:
      'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30',
    dot: 'bg-[#f59e0b]',
  },
  ALTO: {
    label: 'ALTO',
    className:
      'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30',
    dot: 'bg-[#f97316]',
  },
  CRITICO: {
    label: 'CRÍTICO',
    className:
      'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30',
    dot: 'bg-[#ef4444]',
  },
}

export function ConfidentialityBadge({
  level,
  showIcon = true,
  size = 'md',
}: ConfidentialityBadgeProps) {
  const config = LEVEL_CONFIG[level]
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${config.className}`}
    >
      {showIcon && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      )}
      {config.label}
    </span>
  )
}

/** Selector de nivel de confidencialidad */
export function ConfidentialitySelector({
  value,
  onChange,
  disabled,
}: {
  value: ConfidentialityLevel
  onChange: (level: ConfidentialityLevel) => void
  disabled?: boolean
}) {
  const levels: ConfidentialityLevel[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']

  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((level) => {
        const config = LEVEL_CONFIG[level]
        const isSelected = value === level
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 border transition-all duration-150
              ${isSelected ? config.className + ' ring-2 ring-offset-2 ring-offset-[#1e293b] ring-current' : 'border-[#334155] text-[#64748b] hover:border-[#475569]'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
