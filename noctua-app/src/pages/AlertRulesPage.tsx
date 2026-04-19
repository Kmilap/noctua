import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import AlertRuleCard, { type AlertRule } from '../components/AlertRuleCard'
import AlertRuleModal from '../components/AlertRuleModal'

export default function AlertRulesPage() {
  const { token } = useAuth()
  const { can } = usePermissions()
  const headers = { Authorization: `Bearer ${token}` }

  // Estado principal
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Estado del modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>(undefined)

  // Permisos — el backend igual valida, pero escondemos UI para no frustrar
  const canCreate = can('alert-rules')
  // Según la guía de Camila: admin puede borrar, operator NO puede borrar.
  // Por eso usamos `role === 'admin'` para delete.
  const { role } = usePermissions()
  const canDelete = role === 'admin'
  const canEdit = can('alert-rules')  // admin + operator pueden editar

  // Fetch inicial de reglas
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/alert-rules', { headers })
        // El backend devuelve paginación Laravel: { data: [...], current_page, ... }
        // Las reglas reales están en res.data.data
        setRules(res.data.data ?? [])
      } catch {
        setError('No se pudieron cargar las reglas de alerta.')
      } finally {
        setLoading(false)
      }
    }
    fetchRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle real contra el backend
  const handleToggle = async (rule: AlertRule) => {
    // Optimistic update: cambiar UI inmediatamente
    const previousRules = rules
    setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))

    try {
      const res = await axios.patch(
        `http://localhost:8000/api/alert-rules/${rule.id}/toggle-active`,
        {},
        { headers }
      )
      // Sincronizar con la respuesta real del backend (por si cambió algo más)
      setRules(prev => prev.map(r => r.id === rule.id ? res.data : r))
    } catch {
      // Revertir si falla
      setRules(previousRules)
      setError('No se pudo cambiar el estado de la regla.')
      setTimeout(() => setError(''), 3000)
    }
  }

  // Edición: abre el modal con los datos de la regla
  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule)
    setIsModalOpen(true)
  }

  // Delete real contra el backend
  const handleDelete = async (rule: AlertRule) => {
    const confirmed = confirm(
      `¿Eliminar la regla de "${rule.service?.name}"? Esta acción también eliminará sus incidentes asociados.`
    )
    if (!confirmed) return

    try {
      await axios.delete(`http://localhost:8000/api/alert-rules/${rule.id}`, { headers })
      setRules(rules.filter(r => r.id !== rule.id))
    } catch {
      setError('No se pudo eliminar la regla.')
      setTimeout(() => setError(''), 3000)
    }
  }

  // Click en "+ Nueva regla"
  const handleCreateClick = () => {
    setEditingRule(undefined)
    setIsModalOpen(true)
  }

  // Callback cuando el modal guarda exitosamente
  const handleSuccess = (savedRule: AlertRule) => {
    if (editingRule) {
      setRules(rules.map(r => r.id === savedRule.id ? savedRule : r))
    } else {
      setRules([...rules, savedRule])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Reglas de alerta
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configurá las condiciones que disparan alertas en tus servicios.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={handleCreateClick}
            className="
              bg-[color:var(--color-noctua-amber)]
              hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold
              px-5 py-2.5 rounded-lg
              transition-colors duration-200
              glow-amber
              shrink-0
            "
          >
            + Nueva regla
          </button>
        )}
      </div>

      {/* Error banner temporal */}
      {error && (
        <div className="bg-[color:var(--color-severity-critical-bg)] border border-[color:var(--color-severity-critical)]/30 text-[color:var(--color-severity-critical)] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Estados: loading / empty / lista */}
      {loading ? (
        // Skeleton loading — más premium que "Cargando..."
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="
                bg-[color:var(--color-noctua-surface)]/30
                border border-[color:var(--color-noctua-border)]/30
                rounded-xl px-5 py-4
                animate-pulse
              "
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-56 bg-white/5 rounded" />
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-16 bg-white/10 rounded" />
                  <div className="h-6 w-11 bg-white/10 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-[color:var(--color-noctua-surface)]/40 border border-dashed border-[color:var(--color-noctua-border)]/60 rounded-xl px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            Todavía no hay reglas de alerta.{' '}
            {canCreate
              ? 'Creá tu primera con el botón de arriba.'
              : 'Pedile al admin que cree la primera.'
            }
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rules.map((rule, index) => (
            <AlertRuleCard
              key={rule.id}
              rule={rule}
              onToggleActive={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canEdit={canEdit}
              canDelete={canDelete}
              animationDelay={index * 50}
            />
          ))}
        </div>
      )}

      {/* Modal de crear/editar */}
      <AlertRuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rule={editingRule}
        onSuccess={handleSuccess}
      />
    </div>
  )
}