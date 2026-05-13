import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import Modal from '../components/Modal'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Newspaper, Database, Zap, Wrench, Globe, Workflow,
  Play, Square, RotateCcw, ExternalLink
} from 'lucide-react'

type ContainerStatus = 'stopped' | 'starting' | 'running' | 'error' | 'removing' | 'missing' | null

type Service = {
  id: number
  name: string
  url: string | null
  status: 'active' | 'warning' | 'critical' | 'unknown'
  check_interval_seconds: number
  last_seen_at: string | null
  uptime_24h: number | null
  alert_rules_count?: number
  template_id: number | null
  container_id: string | null
  container_status: ContainerStatus
  host_port: number | null
  api_key?: string | null
}

type ServiceTemplate = {
  id: number
  name: string
  slug: string
  image: string
  internal_port: number
  category: string
  description: string
  icon: string
  persistent: boolean
}

type ModalMode = 'choice' | 'external' | 'template'

const statusConfig = {
  active:   { label: 'Activo',      dot: 'bg-emerald-400', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' },
  warning:  { label: 'Warning',     dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20' },
  critical: { label: 'Crítico',     dot: 'bg-red-400',     badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
  unknown:  { label: 'Desconocido', dot: 'bg-gray-500',    badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

const containerStatusConfig: Record<NonNullable<ContainerStatus>, { label: string; dot: string; badge: string }> = {
  running:  { label: 'Corriendo',  dot: 'bg-emerald-400 animate-pulse', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' },
  starting: { label: 'Iniciando',  dot: 'bg-amber-400 animate-pulse',   badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20' },
  stopped:  { label: 'Detenido',   dot: 'bg-gray-500',                  badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
  error:    { label: 'Error',      dot: 'bg-red-400',                   badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
  removing: { label: 'Eliminando', dot: 'bg-orange-400 animate-pulse',  badge: 'bg-orange-400/15 text-orange-400 border-orange-400/20' },
  missing:  { label: 'Perdido',    dot: 'bg-red-400',                   badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
}

const templateIconMap: Record<string, React.ReactNode> = {
  'code-2':    <Code2 size={18} />,
  'newspaper': <Newspaper size={18} />,
  'database':  <Database size={18} />,
  'zap':       <Zap size={18} />,
  'wrench':    <Wrench size={18} />,
  'globe':     <Globe size={18} />,
  'workflow':  <Workflow size={18} />,
}

type ServiceCardProps = {
  svc: Service
  index: number
  templates: ServiceTemplate[]
  canManageContainers: boolean
  actionLoading: Record<number, string>
  newServiceKeys: Record<number, string>
  copied: number | null
  onContainerAction: (svc: Service, action: 'start' | 'stop' | 'restart') => void
  onCopy: (svc: Service) => void
}
function ServiceCard({
  svc, index, templates, canManageContainers,
  actionLoading, newServiceKeys, copied,
  onContainerAction, onCopy,
}: ServiceCardProps) {
    const cfg    = statusConfig[svc.status] ?? statusConfig.unknown
    const csCfg  = svc.container_status ? containerStatusConfig[svc.container_status] : null
    const tpl    = svc.template_id ? templates.find(t => t.id === svc.template_id) : null
    const intervalLabel = svc.check_interval_seconds >= 60
      ? (svc.check_interval_seconds / 60) + 'm'
      : svc.check_interval_seconds + 's'
    const isActioning = !!actionLoading[svc.id]
    const serviceUrl  = svc.host_port ? 'http://localhost:' + String(svc.host_port) : ''
    const portLabel   = svc.host_port ? 'localhost:' + String(svc.host_port) : ''

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="rounded-2xl px-6 py-5 flex flex-col gap-4 border border-white/8 hover:border-white/15 transition-all duration-300"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {tpl ? (
              <div className="w-8 h-8 rounded-lg bg-[color:var(--color-noctua-amber)]/15 flex items-center justify-center shrink-0 text-[color:var(--color-noctua-amber)]">
                {templateIconMap[tpl.icon] ?? <Code2 size={16} />}
              </div>
            ) : (
              <span className={'w-2 h-2 rounded-full shrink-0 mt-0.5 ' + cfg.dot} />
            )}
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate">{svc.name}</p>
              {tpl && <p className="text-xs text-gray-500 truncate mt-0.5">{tpl.category}</p>}
              {svc.url && !tpl && <p className="text-xs text-gray-500 truncate mt-0.5">{svc.url}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={'px-2.5 py-0.5 rounded-md text-xs font-semibold border ' + cfg.badge}>
              {cfg.label}
            </span>
            <AnimatePresence mode="wait">
              {csCfg && (
                <motion.span
                  key={svc.container_status}
                  initial={{ opacity: 0, scale: 0.8, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={'flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ' + csCfg.badge}
                >
                  <span className={'w-1.5 h-1.5 rounded-full ' + csCfg.dot} />
                  {csCfg.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Intervalo',  value: tpl ? 'Puerto ' + (svc.host_port ?? '—') : intervalLabel },
            { label: 'Plantilla',  value: tpl ? tpl.name : 'Externo' },
            { label: 'Uptime 24h', value: svc.uptime_24h != null ? parseFloat(String(svc.uptime_24h)).toFixed(1) + '%' : '—' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-xs text-gray-500 mb-0.5">{stat.label}</p>
              <p className="text-sm font-bold text-white tabular-nums truncate">{stat.value}</p>
            </div>
          ))}
        </div>

        {tpl && canManageContainers && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onContainerAction(svc, 'start')}
              disabled={isActioning || svc.container_status === 'running'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={12} />
              {actionLoading[svc.id] === 'start' ? '...' : 'Iniciar'}
            </button>
            <button
              onClick={() => onContainerAction(svc, 'stop')}
              disabled={isActioning || svc.container_status === 'stopped'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/12 text-gray-300 border border-white/10 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square size={12} />
              {actionLoading[svc.id] === 'stop' ? '...' : 'Detener'}
            </button>
            <button
              onClick={() => onContainerAction(svc, 'restart')}
              disabled={isActioning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/12 text-gray-300 border border-white/10 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={12} />
            </button>
            {svc.container_status === 'running' && svc.host_port && (
              <a href={serviceUrl} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[color:var(--color-noctua-amber)]/15 hover:bg-[color:var(--color-noctua-amber)]/25 text-[color:var(--color-noctua-amber)] border border-[color:var(--color-noctua-amber)]/20 transition-colors duration-200">
                <ExternalLink size={12} />{portLabel}
              </a>
            )}
          </div>
        )}

        {!tpl && (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 bg-black/20 border border-white/8 rounded-lg px-3 py-1.5 text-xs font-mono truncate"
              style={{ color: newServiceKeys[svc.id] ? '#ef9f27' : '#9ca3af' }}
            >
              {newServiceKeys[svc.id] ? newServiceKeys[svc.id] : 'nct_sk_••••••••••••••••'}
            </div>
            {newServiceKeys[svc.id] && (
              <button
                onClick={() => onCopy(svc)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[color:var(--color-noctua-amber)]/15 hover:bg-[color:var(--color-noctua-amber)]/25 text-[color:var(--color-noctua-amber)] border border-[color:var(--color-noctua-amber)]/20 transition-colors duration-200"
              >
                {copied === svc.id ? '¡Copiado!' : 'Copiar'}
              </button>
            )}
          </div>
        )}
      </motion.div>
    )
}

export default function ServicesPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const headers   = { Authorization: `Bearer ${token}` }

  const canCreate           = role === 'admin' || role === 'operator'
  const canManageContainers = role === 'admin' || role === 'operator'
  const canCreateTemplate   = role === 'admin' || role === 'operator'

  const [services, setServices]   = useState<Service[]>([])
  const [filtered, setFiltered]   = useState<Service[]>([])
  const [templates, setTemplates] = useState<ServiceTemplate[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [isModalOpen, setModal]   = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('choice')
  const [copied, setCopied]       = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({})
  const [newServiceKeys, setNewServiceKeys] = useState<Record<number, string>>({})

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedToDelete, setSelectedToDelete] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({ name: '', url: '', interval: '30', unit: 'seconds' })
  const [formError, setFormError]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null)
  const [tplName, setTplName] = useState('')
  const [tplPort, setTplPort] = useState('')
  const [tplError, setTplError] = useState('')

  useEffect(() => {
    fetchServices()
    fetchTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? services.filter(s => s.name.toLowerCase().includes(q)) : services)
  }, [search, services])

  const fetchServices = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/services', { headers })
      setServices((res.data ?? []).map((s: any) => ({
        id:                     s.id,
        name:                   s.name,
        url:                    s.url ?? null,
        status:                 s.status ?? 'unknown',
        check_interval_seconds: s.check_interval_seconds ?? 60,
        uptime_24h:             null,
        last_seen_at:           s.last_seen_at ?? null,
        template_id:            s.template_id ?? null,
        container_id:           s.container_id ?? null,
        container_status:       s.container_status ?? null,
        host_port:              s.host_port ?? null,
      })))
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/service-templates', { headers })
      setTemplates(res.data.data ?? [])
    } catch { /* silencioso */ }
  }

  const openModal = () => {
    setModalMode('choice')
    setFormError('')
    setTplError('')
    setSelectedTemplate(null)
    setTplName('')
    setTplPort('')
    setForm({ name: '', url: '', interval: '30', unit: 'seconds' })
    setModal(true)
  }

  const handleCopy = (svc: Service) => {
    const key = newServiceKeys[svc.id]
    if (!key) return
    navigator.clipboard.writeText(key)
    setCopied(svc.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmitExternal = async () => {
    if (!form.name.trim()) { setFormError('El nombre es requerido.'); return }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await axios.post('http://localhost:8000/api/services', {
        name: form.name.trim(),
        url:  form.url.trim() || null,
        check_interval_seconds: parseInt(form.interval) * (form.unit === 'minutes' ? 60 : 1),
      }, { headers })
      const created = res.data
      setServices(prev => [{ ...created, template_id: null, container_id: null, container_status: null, host_port: null }, ...prev])
      if (created.api_key) {
        setNewServiceKeys(prev => ({ ...prev, [created.id]: created.api_key }))
      }
      setModal(false)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setFormError(Object.values(errs).flat().join(' '))
      } else {
        setFormError('Error al crear el servicio.')
      }
    } finally { setSubmitting(false) }
  }

  const handleSubmitTemplate = async () => {
    if (!tplName.trim()) { setTplError('El nombre es requerido.'); return }
    if (!tplPort || parseInt(tplPort) < 1024 || parseInt(tplPort) > 9999) {
      setTplError('El puerto debe estar entre 1024 y 9999.')
      return
    }
    if (!selectedTemplate) { setTplError('Seleccioná una plantilla.'); return }
    setSubmitting(true)
    setTplError('')
    try {
      await axios.post('http://localhost:8000/api/services', {
        name:        tplName.trim(),
        template_id: selectedTemplate.id,
        host_port:   parseInt(tplPort),
      }, { headers })
      setModal(false)
      await fetchServices()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setTplError(Object.values(errs).flat().join(' '))
      } else if (axios.isAxiosError(err) && err.response?.data?.message) {
        setTplError(err.response.data.message)
      } else {
        setTplError('Error al crear el servicio.')
      }
    } finally { setSubmitting(false) }
  }

  const handleContainerAction = async (svc: Service, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(prev => ({ ...prev, [svc.id]: action }))
    const optimisticStatus: ContainerStatus = action === 'start' ? 'starting' : action === 'stop' ? 'stopped' : 'starting'
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, container_status: optimisticStatus } : s))
    try {
      await axios.post('http://localhost:8000/api/services/' + svc.id + '/' + action, {}, { headers })
      if (action !== 'stop') {
        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          try {
            const res = await axios.get('http://localhost:8000/api/services/' + svc.id, { headers })
            const newStatus = res.data.container_status
            setServices(prev => prev.map(s => s.id === svc.id ? { ...s, container_status: newStatus } : s))
            if (newStatus !== 'starting' || attempts >= 20) clearInterval(poll)
          } catch { clearInterval(poll) }
        }, 3000)
      }
    } catch {
      setServices(prev => prev.map(s => s.id === svc.id ? { ...s, container_status: svc.container_status } : s))
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[svc.id]; return n })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedToDelete.size === 0) return
    setDeleting(true)
    const ids = Array.from(selectedToDelete)
    await Promise.allSettled(
      ids.map(id => axios.delete('http://localhost:8000/api/services/' + id, { headers }))
    )
    setServices(prev => prev.filter(s => !selectedToDelete.has(s.id)))
    setSelectedToDelete(new Set())
    setDeleteModalOpen(false)
    setDeleting(false)
  }

  const inputClass = `
    w-full bg-[color:var(--color-noctua-bg)] text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200
  `
  const labelClass = 'text-xs font-semibold text-gray-400 uppercase tracking-wide'

  // Card definida fuera del componente para evitar re-mount en cada render
  const renderCard = (svc: Service, index: number) => (
    <ServiceCard
      key={svc.id} svc={svc} index={index}
      templates={templates}
      canManageContainers={canManageContainers}
      actionLoading={actionLoading}
      newServiceKeys={newServiceKeys}
      copied={copied}
      onContainerAction={handleContainerAction}
      onCopy={handleCopy}
    />
  )
  const filteredTemplates = filtered.filter(s => s.template_id)
  const filteredExternal  = filtered.filter(s => !s.template_id)

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Servicios</h1>
          <p className="text-sm text-gray-400 mt-1">Registra y gestiona los microservicios que Noctua monitorea</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && services.length > 0 && (
            <button
              onClick={() => { setSelectedToDelete(new Set()); setDeleteModalOpen(true) }}
              className="p-2.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 transition-all duration-200"
              title="Eliminar servicios"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
          {canCreate && (
            <button onClick={openModal} className="
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold px-5 py-2.5 rounded-lg
              transition-colors duration-200 glow-amber shrink-0
            ">
              + Nuevo servicio
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <input
          type="text"
          placeholder="Buscar servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-2.5 outline-none border border-white/10 focus:border-white/20 transition-colors duration-200"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-52 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">
            {search ? 'Sin resultados para "' + search + '".' : 'No hay servicios registrados. Creá el primero.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">

          {/* Plantillas / Contenedores */}
          {filteredTemplates.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-[color:var(--color-noctua-amber)]" />
                  <h2 className="text-sm font-bold text-white tracking-wide">Plantillas</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)] border border-[color:var(--color-noctua-amber)]/20">
                    {filteredTemplates.length}
                  </span>
                </div>
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map((svc, i) => renderCard(svc, i))}
              </div>
            </div>
          )}

          {/* Servicios externos */}
          {filteredExternal.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-blue-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">Servicios externos</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-400/15 text-blue-400 border border-blue-400/20">
                    {filteredExternal.length}
                  </span>
                </div>
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredExternal.map((svc, i) => renderCard(svc, i))}
              </div>
            </div>
          )}

        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModal(false)}
        title={modalMode === 'choice' ? 'Nuevo servicio' : modalMode === 'external' ? 'Servicio externo' : 'Servicio con plantilla'}
        subtitle={modalMode === 'choice' ? '¿Qué tipo de servicio querés registrar?' : modalMode === 'external' ? 'Registrá un microservicio para que Noctua lo monitoree.' : 'Elegí una plantilla y configurá el puerto de acceso.'}
        closeOnBackdropClick={false}
      >
        {modalMode === 'choice' && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setModalMode('external')} className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all duration-200 text-left">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Globe size={18} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Servicio externo</p>
                <p className="text-xs text-gray-500 mt-0.5">Monitoreo de un endpoint existente con métricas via API key.</p>
              </div>
            </button>
            {canCreateTemplate && (
              <button onClick={() => setModalMode('template')} className="flex items-start gap-4 p-4 rounded-xl border border-[color:var(--color-noctua-amber)]/20 bg-[color:var(--color-noctua-amber)]/5 hover:bg-[color:var(--color-noctua-amber)]/10 hover:border-[color:var(--color-noctua-amber)]/40 transition-all duration-200 text-left">
                <div className="w-10 h-10 rounded-lg bg-[color:var(--color-noctua-amber)]/15 flex items-center justify-center shrink-0">
                  <Code2 size={18} className="text-[color:var(--color-noctua-amber)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Servicio con plantilla</p>
                  <p className="text-xs text-gray-500 mt-0.5">Levantá un contenedor Docker preconfigurado (Laravel, WordPress, Redis…)</p>
                </div>
              </button>
            )}
          </div>
        )}

        {modalMode === 'external' && (
          <div className="flex flex-col gap-4">
            {formError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2.5">{formError}</div>}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Nombre del servicio</label>
              <input type="text" placeholder="ej. checkout-api" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>URL del endpoint</label>
              <input type="text" placeholder="https://checkout.noctua.dev" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Intervalo</label>
                <input type="number" value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))} className={inputClass + ' tabular-nums'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Unidad</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className={inputClass}>
                  <option value="seconds">segundos</option>
                  <option value="minutes">minutos</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setModalMode('choice')} disabled={submitting} className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 disabled:opacity-50">Atrás</button>
              <button onClick={handleSubmitExternal} disabled={submitting} className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 disabled:opacity-50">{submitting ? 'Creando...' : 'Crear servicio'}</button>
            </div>
          </div>
        )}

        {modalMode === 'template' && (
          <div className="flex flex-col gap-4">
            {tplError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2.5">{tplError}</div>}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Plantilla</label>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {templates.map(t => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t)} className={'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 ' + (selectedTemplate?.id === t.id ? 'border-[color:var(--color-noctua-amber)]/40 bg-[color:var(--color-noctua-amber)]/10 text-white' : 'border-white/10 bg-white/5 hover:bg-white/8 text-gray-300 hover:text-white')}>
                    <span className={'shrink-0 ' + (selectedTemplate?.id === t.id ? 'text-[color:var(--color-noctua-amber)]' : 'text-gray-400')}>
                      {templateIconMap[t.icon] ?? <Code2 size={16} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 truncate">{t.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {selectedTemplate && (
              <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-xs text-gray-400">
                {selectedTemplate.description}
                {selectedTemplate.persistent && <span className="ml-2 text-[color:var(--color-noctua-amber)]">· Persistente</span>}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Nombre del servicio</label>
              <input type="text" placeholder={selectedTemplate ? 'mi-' + selectedTemplate.slug : 'nombre'} value={tplName} onChange={e => setTplName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Puerto de acceso (1024 – 9999)</label>
              <input type="number" placeholder="8090" min={1024} max={9999} value={tplPort} onChange={e => setTplPort(e.target.value)} className={inputClass + ' tabular-nums'} />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setModalMode('choice')} disabled={submitting} className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 disabled:opacity-50">Atrás</button>
              <button onClick={handleSubmitTemplate} disabled={submitting || !selectedTemplate} className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 disabled:opacity-50">{submitting ? 'Creando...' : 'Crear servicio'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal eliminación bulk */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 p-6 flex flex-col gap-5"
            style={{ background: 'rgba(15,14,23,0.98)', backdropFilter: 'blur(20px)' }}
          >
            <div>
              <h2 className="text-lg font-bold text-white">Eliminar servicios</h2>
              <p className="text-sm text-gray-400 mt-1">Seleccioná los servicios que querés eliminar. Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {services.map(svc => {
                const tpl = svc.template_id ? templates.find(t => t.id === svc.template_id) : null
                const checked = selectedToDelete.has(svc.id)
                return (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedToDelete(prev => {
                      const next = new Set(prev)
                      checked ? next.delete(svc.id) : next.add(svc.id)
                      return next
                    })}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                      checked ? 'border-red-500/30 bg-red-500/10' : 'border-white/8 bg-white/3 hover:bg-white/6'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'border-red-400 bg-red-400' : 'border-gray-600'
                    }`}>
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{svc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{tpl ? tpl.name : 'Externo'}</p>
                    </div>
                    {svc.container_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-md border ${containerStatusConfig[svc.container_status]?.badge}`}>
                        {containerStatusConfig[svc.container_status]?.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting || selectedToDelete.size === 0}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Eliminando...' : `Eliminar ${selectedToDelete.size > 0 ? `(${selectedToDelete.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}