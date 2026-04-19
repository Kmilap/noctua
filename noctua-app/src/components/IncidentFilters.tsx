// Valores de filtro. 'all' = sin filtro, se traduce a no mandar ?status=
export type IncidentFilter = 'all' | 'triggered' | 'acknowledged' | 'resolved'

type IncidentFiltersProps = {
  activeFilter: IncidentFilter
  onFilterChange: (filter: IncidentFilter) => void
  // Contadores opcionales por estado (se muestran en pequeño al lado del label)
  counts?: Partial<Record<IncidentFilter, number>>
}

// Config de las tabs. El orden importa: refleja el flujo mental del usuario.
const FILTERS: Array<{ value: IncidentFilter; label: string }> = [
  { value: 'all',          label: 'Todos' },
  { value: 'triggered',    label: 'Activos' },
  { value: 'acknowledged', label: 'Reconocidos' },
  { value: 'resolved',     label: 'Resueltos' },
]

export default function IncidentFilters({
  activeFilter,
  onFilterChange,
  counts,
}: IncidentFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtro de incidentes por estado"
      className="
        inline-flex items-center gap-1
        p-1
        bg-[color:var(--color-noctua-surface)]/40
        border border-[color:var(--color-noctua-border)]/40
        rounded-xl
      "
    >
      {FILTERS.map(filter => {
        const isActive = activeFilter === filter.value
        const count = counts?.[filter.value]

        return (
          <button
            key={filter.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(filter.value)}
            className={`
              relative
              px-4 py-1.5
              text-sm font-medium
              rounded-lg
              transition-all duration-200
              ${isActive
                ? 'bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }
            `}
            style={{ transitionTimingFunction: 'var(--ease-out-quint)' }}
          >
            <span className="flex items-center gap-2">
              {filter.label}
              {count !== undefined && count > 0 && (
                <span
                  className={`
                    tabular-nums text-xs
                    px-1.5 py-0.5 rounded-md
                    ${isActive
                      ? 'bg-[color:var(--color-noctua-amber)]/20 text-[color:var(--color-noctua-amber)]'
                      : 'bg-white/5 text-gray-500'
                    }
                  `}
                >
                  {count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}