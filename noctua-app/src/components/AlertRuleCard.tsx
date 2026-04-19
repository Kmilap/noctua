import { Pencil, Trash2 } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import ToggleSwitch from './ToggleSwitch'

// Tipo completo de una regla de alerta, espejo del backend.
// Exportamos el tipo para que otros archivos puedan reusarlo.
export type AlertRule = {
  id: number
  service_id: number
  metric_name: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: string  // llega como string desde el backend (decimal)
  consecutive_failures: number
  severity: 'info' | 'warning' | 'critical'
  is_active: boolean
  created_at: string
  updated_at: string
  service?: {
    id: number
    name: string
    team_id: number
  }
}

type AlertRuleCardProps = {
  rule: AlertRule
  onToggleActive: (rule: AlertRule) => void
  onEdit: (rule: AlertRule) => void
  onDelete: (rule: AlertRule) => void
  // Permisos opcionales para controlar qué botones mostrar según el rol.
  // Si no se pasan, asumimos que todos los botones están habilitados (default permisivo).
  canEdit?: boolean
  canDelete?: boolean
  // Para animar la entrada con stagger desde la lista padre
  animationDelay?: number
}

export default function AlertRuleCard({
  rule,
  onToggleActive,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  animationDelay = 0,
}: AlertRuleCardProps) {
  // Formateamos el threshold para no mostrar "2000.0000"
  // parseFloat quita los ceros innecesarios: "2000.0000" -> 2000
  // Si el valor tiene decimales reales (ej "99.95"), los preserva.
  const thresholdFormatted = parseFloat(rule.threshold).toString()

  // Descripción humana de la condición:
  // ej: "response_time > 2000 · 3 consecutivas"
  const condition = `${rule.metric_name} ${rule.operator} ${thresholdFormatted}`
  const failuresText = `${rule.consecutive_failures} consecutivas`

  return (
    <div
      className="
        group
        relative
        bg-[color:var(--color-noctua-surface)]/50
        hover:bg-[color:var(--color-noctua-surface)]/80
        border border-[color:var(--color-noctua-border)]/40
        hover:border-[color:var(--color-noctua-border)]
        rounded-xl
        px-5 py-4
        transition-all duration-300
        animate-list-item-enter
      "
      style={{
        transitionTimingFunction: 'var(--ease-out-quint)',
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Lado izquierdo: nombre + condición */}
        <div className="flex-1 min-w-0">
          {/* Nombre del servicio — bold, destacado */}
          <h3 className="text-white font-semibold text-base truncate">
            {rule.service?.name ?? `Servicio #${rule.service_id}`}
          </h3>

          {/* Condición en gris, más pequeña, tabular-nums para números alineados */}
          <p className="text-sm text-gray-400 mt-0.5 tabular-nums">
            <span className="font-mono">{condition}</span>
            <span className="text-gray-600 mx-2">·</span>
            <span>{failuresText}</span>
          </p>
        </div>

        {/* Lado derecho: severity + acciones + toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Badge de severidad */}
          <SeverityBadge severity={rule.severity} />

          {/* Botones de acción — solo visibles en hover para no saturar visualmente.
              Tailwind group-hover:opacity-100 hace que aparezcan al pasar el mouse
              sobre la card (que tiene la clase `group`). */}
          <div
            className="
              flex items-center gap-1
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
            "
          >
            {canEdit && (
              <button
                onClick={() => onEdit(rule)}
                className="
                  p-1.5 rounded-lg
                  text-gray-400 hover:text-white
                  hover:bg-white/5
                  transition-colors duration-200
                "
                aria-label="Editar regla"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(rule)}
                className="
                  p-1.5 rounded-lg
                  text-gray-400 hover:text-[color:var(--color-severity-critical)]
                  hover:bg-[color:var(--color-severity-critical-bg)]
                  transition-colors duration-200
                "
                aria-label="Eliminar regla"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Toggle para activar/desactivar */}
          <ToggleSwitch
            checked={rule.is_active}
            onChange={() => onToggleActive(rule)}
          />
        </div>
      </div>
    </div>
  )
}