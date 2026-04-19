type IncidentStatus = 'triggered' | 'acknowledged' | 'resolved'

type IncidentStatusBadgeProps = {
  status: IncidentStatus
  className?: string
}

// Config visual por estado — las variables vienen del index.css (--color-status-*)
const statusConfig: Record<IncidentStatus, { label: string; textColor: string; bgColor: string; borderColor: string; pulse: boolean }> = {
  triggered: {
    label: 'Disparado',
    textColor: 'text-[color:var(--color-status-triggered)]',
    bgColor: 'bg-[color:var(--color-status-triggered-bg)]',
    borderColor: 'border-[color:var(--color-status-triggered)]/30',
    pulse: true,  // Los triggered pulsan sutilmente para llamar la atencion
  },
  acknowledged: {
    label: 'Reconocido',
    textColor: 'text-[color:var(--color-status-acknowledged)]',
    bgColor: 'bg-[color:var(--color-status-acknowledged-bg)]',
    borderColor: 'border-[color:var(--color-status-acknowledged)]/30',
    pulse: false,
  },
  resolved: {
    label: 'Resuelto',
    textColor: 'text-[color:var(--color-status-resolved)]',
    bgColor: 'bg-[color:var(--color-status-resolved-bg)]',
    borderColor: 'border-[color:var(--color-status-resolved)]/30',
    pulse: false,
  },
}

export default function IncidentStatusBadge({ status, className = '' }: IncidentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`
        relative inline-flex items-center gap-1.5
        px-2.5 py-0.5
        text-xs font-semibold
        rounded-md
        border
        transition-all duration-200
        ${config.textColor}
        ${config.bgColor}
        ${config.borderColor}
        ${className}
      `}
    >
      {/* Dot indicador. Si pulse=true, tiene un halo animado tipo "latido" */}
      <span className="relative flex h-1.5 w-1.5">
        {config.pulse && (
          <span
            className={`
              absolute inline-flex h-full w-full rounded-full
              opacity-60 animate-ping
              ${config.bgColor}
            `}
            style={{ backgroundColor: 'currentColor' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-1.5 w-1.5"
          style={{ backgroundColor: 'currentColor' }}
        />
      </span>
      {config.label}
    </span>
  )
}