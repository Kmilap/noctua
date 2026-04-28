import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import Modal from '../components/Modal'

type Service = {
  id: number
  name: string
  url: string | null
  status: 'active' | 'warning' | 'critical' | 'unknown'
  check_interval_seconds: number
  last_seen_at: string | null
  uptime_24h: number | null
  alert_rules_count?: number
  api_key?: string
}

const statusConfig = {
  active:   { label: 'Activo',      dot: 'bg-emerald-400', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' },
  warning:  { label: 'Warning',     dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20' },
  critical: { label: 'Crítico',     dot: 'bg-red-400',     badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
  unknown:  { label: 'Desconocido', dot: 'bg-gray-500',    badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

export default function ServicesPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const headers   = { Authorization: `Bearer ${token}` }

  const canCreate = role === 'admin' || role === 'operator'

  const [services, setServices]   = useState<Service[]>([])
  const [filtered, setFiltered]   = useState<Service[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [isModalOpen, setModal]   = useState(false)
  const [copied, setCopied]       = useState<number | null>(null)

  // Form state
  const [form, setForm] = useState({
    name: '', url: '', interval: '30', unit: 'seconds',
    method: 'GET', timeout: '5000', tags: ''
  })
  const [formError, setFormError]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchServices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q ? services.filter(s => s.name.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q)) : services
    )
  }, [search, services])

  const fetchServices = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/services', { headers })
      setServices((res.data ?? []).map((s: any) => ({
        id:                    s.id,
        name:                  s.name,
        url:                   s.url ?? null,
        status:                s.status ?? 'unknown',
        check_interval_seconds: s.check_interval_seconds,
        response_time_ms:      null,
        uptime_24h:            null,
        last_seen_at:          s.last_seen_at ?? null,
      })))    
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (svc: Service) => {
    const key = svc.api_key ?? `nct_sk_••••••••`
    navigator.clipboard.writeText(key)
    setCopied(svc.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setFormError('El nombre es requerido.'); return }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await axios.post('http://localhost:8000/api/services', {
        name: form.name.trim(),
        url:  form.url.trim() || null,
        check_interval_seconds: parseInt(form.interval) * (form.unit === 'minutes' ? 60 : 1),
      }, { headers })
      setServices(prev => [res.data, ...prev])
      setModal(false)
      setForm({ name: '', url: '', interval: '30', unit: 'seconds', method: 'GET', timeout: '5000', tags: '' })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setFormError(Object.values(errs).flat().join(' '))
      } else {
        setFormError('Error al crear el servicio.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `
    w-full bg-[color:var(--color-noctua-bg)] text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200
  `

  const labelClass = 'text-xs font-semibold text-gray-400 uppercase tracking-wide'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Servicios</h1>
          <p className="text-sm text-gray-400 mt-1">Registrá y gestioná los microservicios que Noctua monitorea</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModal(true)}
            className="
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold px-5 py-2.5 rounded-lg
              transition-colors duration-200 glow-amber shrink-0
            "
          >
            + Nuevo servicio
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          placeholder="Buscar servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="
            w-full bg-white/5 text-white placeholder-gray-500 text-sm
            rounded-xl px-4 py-2.5 outline-none
            border border-white/10 focus:border-white/20
            transition-colors duration-200
          "
        />
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="
          border border-dashed border-white/10 rounded-2xl px-6 py-12 text-center
          bg-white/2
        ">
          <p className="text-gray-500 text-sm">
            {search ? `Sin resultados para "${search}".` : 'No hay servicios registrados. Creá el primero.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(svc => {
            const cfg = statusConfig[svc.status] ?? statusConfig.unknown
            const intervalLabel = svc.check_interval_seconds >= 60
              ? `${svc.check_interval_seconds / 60}m`
              : `${svc.check_interval_seconds}s`

            return (
              <div
                key={svc.id}
                className="
                  rounded-2xl px-6 py-5 flex flex-col gap-4
                  border border-white/8
                  transition-all duration-300 hover:border-white/15
                  animate-list-item-enter
                "
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
              >
                {/* Top row: nombre + badge estado */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${cfg.dot}`} />
                    <div className="min-w-0">
                      <p className="text-base font-bold text-white truncate">{svc.name}</p>
                      {svc.url && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{svc.url}</p>
                      )}
                    </div>
                  </div>
                  <span className={`
                    shrink-0 px-2.5 py-0.5 rounded-md text-xs font-semibold border
                    ${cfg.badge}
                  `}>
                    {cfg.label}
                  </span>
                </div>

                {/* Stats: Intervalo · Reglas · Uptime */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Intervalo', value: intervalLabel },
                    { label: 'Reglas',    value: svc.alert_rules_count ?? '—' },
                    { label: 'Uptime 24h', value: svc.uptime_24h != null ? `${parseFloat(String(svc.uptime_24h)).toFixed(1)}%` : '—' },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p className="text-xs text-gray-500 mb-0.5">{stat.label}</p>
                      <p className="text-sm font-bold text-white tabular-nums">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* API Key row */}
                <div className="flex items-center gap-2">
                  <div className="
                    flex-1 bg-black/20 border border-white/8 rounded-lg
                    px-3 py-1.5 text-xs font-mono text-gray-400 truncate
                  ">
                    nct_sk_••••••••••••••••
                  </div>
                  <button
                    onClick={() => handleCopy(svc)}
                    className="
                      shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold
                      bg-white/8 hover:bg-white/12 text-gray-300 hover:text-white
                      border border-white/10
                      transition-colors duration-200
                    "
                  >
                    {copied === svc.id ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo servicio */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setModal(false); setFormError('') }}
        title="Nuevo servicio"
        subtitle="Registrá un microservicio para que Noctua lo monitoree."
        closeOnBackdropClick={false}
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2.5">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Nombre del servicio</label>
            <input
              type="text"
              placeholder="ej. checkout-api"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>URL del endpoint</label>
            <input
              type="text"
              placeholder="https://checkout.noctua.dev"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Intervalo de monitoreo</label>
              <input
                type="number"
                value={form.interval}
                onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                className={inputClass + ' tabular-nums'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Unidad</label>
              <select
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className={inputClass}
              >
                <option value="seconds">segundos (s)</option>
                <option value="minutes">minutos (m)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Método HTTP</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                className={inputClass}
              >
                {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Timeout (ms)</label>
              <input
                type="number"
                value={form.timeout}
                onChange={e => setForm(f => ({ ...f, timeout: e.target.value }))}
                className={inputClass + ' tabular-nums'}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Etiquetas <span className="normal-case text-gray-600">(opcional)</span></label>
            <input
              type="text"
              placeholder="producción, api, checkout..."
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => { setModal(false); setFormError('') }}
              disabled={submitting}
              className="
                flex-1 px-4 py-3 rounded-lg text-sm font-semibold
                text-gray-300 hover:text-white bg-white/5 hover:bg-white/10
                border border-white/10 transition-colors duration-200 disabled:opacity-50
              "
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="
                flex-1 px-4 py-3 rounded-lg text-sm font-bold text-black
                bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
                glow-amber transition-colors duration-200 disabled:opacity-50
              "
            >
              {submitting ? 'Creando...' : 'Crear servicio'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}