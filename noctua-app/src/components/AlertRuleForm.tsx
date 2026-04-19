import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import type { AlertRule } from './AlertRuleCard'

// Tipo de servicio (para el dropdown).
// Coincide con lo que devuelve GET /api/services (mismo formato que ya usa ServicesPage)
type Service = {
  id: number
  name: string
}

// Props del formulario.
// Si `initialData` viene, estamos en modo edición. Si no, es creación.
type AlertRuleFormProps = {
  initialData?: AlertRule
  onSuccess: (rule: AlertRule) => void
  onCancel: () => void
}

// Operadores y severidades válidas según la guía de Camila
const OPERATORS: Array<{ value: AlertRule['operator']; label: string }> = [
  { value: '>',  label: '> (mayor que)' },
  { value: '<',  label: '< (menor que)' },
  { value: '>=', label: '>= (mayor o igual)' },
  { value: '<=', label: '<= (menor o igual)' },
  { value: '==', label: '== (igual)' },
  { value: '!=', label: '!= (distinto)' },
]

const SEVERITIES: Array<{ value: AlertRule['severity']; label: string }> = [
  { value: 'info',     label: 'Info' },
  { value: 'warning',  label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]

export default function AlertRuleForm({
  initialData,
  onSuccess,
  onCancel,
}: AlertRuleFormProps) {
  const { token } = useAuth()
  const headers = { Authorization: `Bearer ${token}` }
  const isEditMode = !!initialData

  // Estado del formulario. Si es edición, precarga los valores de initialData.
  const [serviceId, setServiceId]                     = useState<number | ''>(initialData?.service_id ?? '')
  const [metricName, setMetricName]                   = useState(initialData?.metric_name ?? 'response_time')
  const [operator, setOperator]                       = useState<AlertRule['operator']>(initialData?.operator ?? '>')
  const [threshold, setThreshold]                     = useState<string>(initialData ? parseFloat(initialData.threshold).toString() : '2000')
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(initialData?.consecutive_failures ?? 3)
  const [severity, setSeverity]                       = useState<AlertRule['severity']>(initialData?.severity ?? 'warning')

  // Estado auxiliar
  const [services, setServices]             = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [submitting, setSubmitting]         = useState(false)
  const [errors, setErrors]                 = useState<Record<string, string>>({})

  // Cargar servicios para el dropdown cuando se monta el form
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/services', { headers })
        setServices(res.data)
        // Si no hay service seleccionado todavía y hay servicios disponibles,
        // seleccionar el primero por defecto (solo en modo creación)
        if (!isEditMode && res.data.length > 0 && serviceId === '') {
          setServiceId(res.data[0].id)
        }
      } catch {
        setErrors(prev => ({ ...prev, general: 'No se pudieron cargar los servicios.' }))
      } finally {
        setLoadingServices(false)
      }
    }
    fetchServices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Validación del lado cliente antes de mandar al backend.
  // El backend también valida — esto es solo para evitar viajes innecesarios.
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!serviceId) newErrors.service_id = 'Seleccioná un servicio.'
    if (!metricName.trim()) newErrors.metric_name = 'La métrica es requerida.'
    if (metricName.length > 100) newErrors.metric_name = 'Máximo 100 caracteres.'
    if (threshold === '' || isNaN(parseFloat(threshold))) newErrors.threshold = 'Umbral inválido.'
    if (consecutiveFailures < 1 || consecutiveFailures > 100) newErrors.consecutive_failures = 'Entre 1 y 100.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Submit: crea (POST) o actualiza (PATCH) según el modo
  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setErrors({})

    const payload = {
      service_id: Number(serviceId),
      metric_name: metricName.trim(),
      operator,
      threshold: parseFloat(threshold),
      consecutive_failures: consecutiveFailures,
      severity,
    }

    try {
      let res
      if (isEditMode && initialData) {
        // En edición no mandamos service_id (el backend lo ignora igual,
        // pero es más prolijo no mandarlo)
        const { service_id, ...updatePayload } = payload
        res = await axios.patch(
          `http://localhost:8000/api/alert-rules/${initialData.id}`,
          updatePayload,
          { headers }
        )
      } else {
        res = await axios.post('http://localhost:8000/api/alert-rules', payload, { headers })
      }
      onSuccess(res.data)
    } catch (err) {
      // Manejo de errores 422 del backend (validación Laravel)
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const backendErrors = err.response.data.errors ?? {}
        // Laravel devuelve errors como { field: [mensaje1, mensaje2] }
        // Tomamos el primer mensaje de cada field.
        const flatErrors: Record<string, string> = {}
        Object.keys(backendErrors).forEach(key => {
          flatErrors[key] = Array.isArray(backendErrors[key])
            ? backendErrors[key][0]
            : backendErrors[key]
        })
        setErrors(flatErrors)
      } else {
        setErrors({ general: 'Error al guardar la regla. Intentá de nuevo.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Clase base para todos los inputs — consistencia visual
  const inputClass = `
    w-full
    bg-[color:var(--color-noctua-bg)]
    text-white placeholder-gray-500
    rounded-lg px-4 py-2.5 text-sm
    outline-none
    border border-[color:var(--color-noctua-border)]/60
    focus:border-[color:var(--color-noctua-amber)]
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `

  const labelClass = 'text-xs font-semibold text-gray-300 uppercase tracking-wide'
  const errorClass = 'text-xs text-[color:var(--color-severity-critical)] mt-1'

  return (
    <div className="flex flex-col gap-4">
      {/* Error general (por ej. fallo de red) */}
      {errors.general && (
        <div className="bg-[color:var(--color-severity-critical-bg)] border border-[color:var(--color-severity-critical)]/30 rounded-lg px-4 py-2.5">
          <p className="text-sm text-[color:var(--color-severity-critical)]">
            {errors.general}
          </p>
        </div>
      )}

      {/* Campo 1: Servicio */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Servicio</label>
        {loadingServices ? (
          <div className={inputClass + ' text-gray-500'}>Cargando servicios...</div>
        ) : services.length === 0 ? (
          <div className="text-sm text-gray-400 bg-[color:var(--color-noctua-bg)] rounded-lg px-4 py-2.5 border border-[color:var(--color-noctua-border)]/60">
            Primero creá un servicio en la sección <span className="text-white font-semibold">Servicios</span>.
          </div>
        ) : (
          <select
            value={serviceId}
            onChange={e => setServiceId(Number(e.target.value))}
            className={inputClass}
            disabled={isEditMode}  // En edición no se puede cambiar
          >
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {errors.service_id && <p className={errorClass}>{errors.service_id}</p>}
        {isEditMode && (
          <p className="text-xs text-gray-500">El servicio no se puede cambiar una vez creada la regla.</p>
        )}
      </div>

      {/* Campo 2: Métrica */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Métrica</label>
        <input
          type="text"
          value={metricName}
          onChange={e => setMetricName(e.target.value)}
          placeholder="response_time, error_rate, queue_size..."
          className={inputClass + ' font-mono'}
          maxLength={100}
        />
        {errors.metric_name && <p className={errorClass}>{errors.metric_name}</p>}
      </div>

      {/* Fila: Condición (operador + threshold) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Condición</label>
          <select
            value={operator}
            onChange={e => setOperator(e.target.value as AlertRule['operator'])}
            className={inputClass + ' font-mono'}
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Umbral</label>
          <input
            type="number"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            placeholder="2000"
            className={inputClass + ' tabular-nums'}
            step="any"
          />
          {errors.threshold && <p className={errorClass}>{errors.threshold}</p>}
        </div>
      </div>

      {/* Fila: Fallas consecutivas + Severidad */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Fallas consecutivas</label>
          <input
            type="number"
            min={1}
            max={100}
            value={consecutiveFailures}
            onChange={e => setConsecutiveFailures(Number(e.target.value))}
            className={inputClass + ' tabular-nums'}
          />
          {errors.consecutive_failures && <p className={errorClass}>{errors.consecutive_failures}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Severidad</label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as AlertRule['severity'])}
            className={inputClass}
          >
            {SEVERITIES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="
            flex-1
            px-4 py-3 rounded-lg
            text-sm font-semibold
            text-gray-300 hover:text-white
            bg-white/5 hover:bg-white/10
            border border-[color:var(--color-noctua-border)]/60
            transition-colors duration-200
            disabled:opacity-50
          "
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loadingServices || services.length === 0}
          className="
            flex-1
            px-4 py-3 rounded-lg
            text-sm font-bold
            text-black
            bg-[color:var(--color-noctua-amber)]
            hover:bg-[color:var(--color-noctua-amber-hover)]
            glow-amber
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {submitting
            ? (isEditMode ? 'Guardando...' : 'Creando...')
            : (isEditMode ? 'Guardar cambios' : 'Crear regla')
          }
        </button>
      </div>
    </div>
  )
}