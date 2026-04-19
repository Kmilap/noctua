import SeverityBadge from './SeverityBadge'
import IncidentStatusBadge from './IncidentStatusBadge'
import { formatRelativeTime, formatAbsoluteTime } from '../utils/formatRelativeTime'

// Tipo de AlertIncident. Espejo del backend segun la guia de Camila.
// Incluye las relaciones eager-loaded (alert_rule con su service).
export type AlertIncident = {
  id: number
  alert_rule_id: number
  status: 'triggered' | 'acknowledged' | 'resolved'
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  // Cuando el incidente fue reconocido/resuelto, el backend devuelve un objeto usuario.
  // Cuando esta null, nadie lo ha reconocido/resuelto aun.
  acknowledged_by: { id: number; name: string; email: string } | null
  resolved_by: { id: number; name: string; email: string } | null
  alert_rule: {
    id: number
    service_id: number
    metric_name: string
    operator: string
    threshold: string
    severity: 'info' | 'warning' | 'critical'
    service?: {
      id: number
      name: string
      team_id: number
    }
  }
}

type IncidentCardProps = {
  incident: AlertIncident
  onAcknowledge: (incident: AlertIncident) => void
  onResolve: (incident: AlertIncident) => void
  canActOnIncident?: boolean
  animationDelay?: number
}

export default function IncidentCard({
  incident,
  onAcknowledge,
  onResolve,
  canActOnIncident = true,
  animationDelay = 0,
}: IncidentCardProps) {
  const { alert_rule, status, triggered_at, acknowledged_by, resolved_by } = incident

  // Threshold limpio sin ceros de sobra
  const thresholdFormatted = parseFloat(alert_rule.threshold).toString()
  const condition = `${alert_rule.metric_name} ${alert_rule.operator} ${thresholdFormatted}`

  // ID formateado estilo "INC-047" (como el Figma)
  const incidentIdFormatted = `INC-${String(incident.id).padStart(3, '0')}`

  // Descripcion humana del incidente
  const serviceName = alert_rule.service?.name ?? `Servicio #${alert_rule.service_id}`
  const description = status === 'resolved'
    ? `Incidente resuelto en ${serviceName}.`
    : status === 'acknowledged'
      ? `Incidente reconocido en ${serviceName}. En proceso de resolucion.`
      : `${serviceName} esta violando la regla configurada.`

  // Quien reconocio/resolvio (para mostrar al pie de la card)
  const footerText = status === 'resolved' && resolved_by
    ? `Resuelto por ${resolved_by.name}`
    : status === 'acknowledged' && acknowledged_by
      ? `Reconocido por ${acknowledged_by.name}`
      : null

  // Botones de accion segun estado
  const showAcknowledge = status === 'triggered' && canActOnIncident
  const showResolve = status !== 'resolved' && canActOnIncident

  return (
    <div
      className="
        group
        relative
        bg-[color:var(--color-noctua-surface)]/50
        hover:bg-[color:var(--color-noctua-surface)]/70
        border border-[color:var(--color-noctua-border)]/40
        hover:border-[color:var(--color-noctua-border)]
        rounded-xl
        px-6 py-5
        transition-all duration-300
        animate-list-item-enter
      "
      style={{
        transitionTimingFunction: 'var(--ease-out-quint)',
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-6">
        {/* Lado izquierdo: informacion principal del incidente */}
        <div className="flex-1 min-w-0">
          {/* ID del incidente (pequeno, arriba) */}
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            {incidentIdFormatted}
          </p>

          {/* Nombre del servicio (titulo principal) */}
          <h3 className="text-white font-bold text-lg tracking-tight">
            {serviceName}
          </h3>

          {/* Condicion de la regla */}
          <p className="text-sm text-gray-400 mt-0.5 tabular-nums">
            <span className="font-mono">{condition}</span>
          </p>

          {/* Descripcion */}
          <p className="text-sm text-gray-300 mt-3">
            {description}
          </p>

          {/* Footer: quien reconocio/resolvio (solo si aplica) */}
          {footerText && (
            <p className="text-xs text-gray-500 mt-3 italic">
              {footerText}
            </p>
          )}
        </div>

        {/* Lado derecho: badges + tiempo + boton de accion */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {/* Fila de badges: estado + severidad */}
          <div className="flex items-center gap-2">
            <IncidentStatusBadge status={status} />
            <SeverityBadge severity={alert_rule.severity} />
          </div>

          {/* Tiempo relativo con tooltip de tiempo absoluto */}
          <p
            className="text-xs text-gray-500 tabular-nums"
            title={formatAbsoluteTime(triggered_at)}
          >
            {formatRelativeTime(triggered_at)}
          </p>

          {/* Botones de accion */}
          {(showAcknowledge || showResolve) && (
            <div className="flex items-center gap-2 mt-1">
              {showAcknowledge && (
                <button
                  onClick={() => onAcknowledge(incident)}
                  className="
                    bg-[color:var(--color-noctua-amber)]
                    hover:bg-[color:var(--color-noctua-amber-hover)]
                    text-black font-semibold
                    text-sm
                    px-4 py-2 rounded-lg
                    transition-colors duration-200
                    glow-amber
                  "
                >
                  Reconocer
                </button>
              )}
              {showResolve && (
                <button
                  onClick={() => onResolve(incident)}
                  className={`
                    ${showAcknowledge
                      ? 'text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-[color:var(--color-noctua-border)]/60'
                      : 'bg-[color:var(--color-status-resolved)]/15 hover:bg-[color:var(--color-status-resolved)]/25 text-[color:var(--color-status-resolved)] border border-[color:var(--color-status-resolved)]/30'
                    }
                    font-semibold text-sm
                    px-4 py-2 rounded-lg
                    transition-colors duration-200
                  `}
                >
                  Resolver
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}