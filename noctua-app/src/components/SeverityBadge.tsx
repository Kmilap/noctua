type Severity = 'info' | 'warning' | 'critical'

type SeverityBadgeProps = {
  severity: Severity
  className?: string
}

// Configuración visual por severidad.
// Usamos las variables CSS que definimos en index.css para mantener consistencia
// y poder ajustar la paleta desde un solo lugar si hace falta.
const severityConfig: Record<Severity, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  info: {
    label: 'Info',
    textColor: 'text-[color:var(--color-severity-info)]',
    bgColor: 'bg-[color:var(--color-severity-info-bg)]',
    borderColor: 'border-[color:var(--color-severity-info)]/20',
  },
  warning: {
    label: 'Warning',
    textColor: 'text-[color:var(--color-severity-warning)]',
    bgColor: 'bg-[color:var(--color-severity-warning-bg)]',
    borderColor: 'border-[color:var(--color-severity-warning)]/20',
  },
  critical: {
    label: 'Critical',
    textColor: 'text-[color:var(--color-severity-critical)]',
    bgColor: 'bg-[color:var(--color-severity-critical-bg)]',
    borderColor: 'border-[color:var(--color-severity-critical)]/20',
  },
}

export default function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const config = severityConfig[severity]

  return (
    <span
      className={`
        inline-flex items-center justify-center
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
      {config.label}
    </span>
  )
}