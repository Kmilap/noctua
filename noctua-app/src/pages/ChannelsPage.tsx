import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import Modal from '../components/Modal'
import ToggleSwitch from '../components/ToggleSwitch'

type ChannelType = 'email' | 'slack' | 'sms'

type NotificationChannel = {
  id: number
  type: ChannelType
  name: string
  config: Record<string, string>
  is_active: boolean
  notifications_count?: number
}

const typeConfig: Record<ChannelType, {
  label: string
  icon: string
  iconBg: string
  iconColor: string
  badge: string
  configLabel: string
}> = {
  email: {
    label: 'Email',
    icon: '@',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20',
    configLabel: 'SMTP configurado',
  },
  slack: {
    label: 'Slack',
    icon: '#',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    badge: 'bg-violet-400/15 text-violet-400 border-violet-400/20',
    configLabel: 'Webhook configurado',
  },
  sms: {
    label: 'SMS',
    icon: '!',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20',
    configLabel: 'Twilio configurado',
  },
}

// Campos dinámicos según el tipo de canal
const channelFields: Record<ChannelType, Array<{ key: string; label: string; placeholder: string; type?: string }>> = {
email: [
  { key: 'address', label: 'Correo destino', placeholder: 'equipo@empresa.com' },
],
  slack: [
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
    { key: 'channel',     label: 'Canal',       placeholder: '#alertas-prod' },
  ],
  sms: [
    { key: 'to',               label: 'Número destino',  placeholder: '+57 300 000 0000' },
    { key: 'twilio_sid',       label: 'Twilio SID',      placeholder: 'ACxxxxxxxxxxxxxxxx' },
    { key: 'twilio_token',     label: 'Twilio Token',    placeholder: 'xxxxxxxxxxxxxxxx', type: 'password' },
    { key: 'twilio_from',      label: 'Número origen',   placeholder: '+1 555 000 0000' },
  ],
}

export default function ChannelsPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const headers   = { Authorization: `Bearer ${token}` }

  const [channels, setChannels]   = useState<NotificationChannel[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [isModalOpen, setModal]   = useState(false)
  const [editingChannel, setEditing] = useState<NotificationChannel | undefined>()

  // Form state
  const [formType, setFormType]   = useState<ChannelType>('email')
  const [formName, setFormName]   = useState('')
  const [formConfig, setFormConfig] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchChannels() }, [])

  const fetchChannels = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/notification-channels', { headers })
      setChannels(res.data.data ?? [])
    } catch {
      setError('No se pudieron cargar los canales.')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditing(undefined)
    setFormType('email')
    setFormName('')
    setFormConfig({})
    setFormError('')
    setModal(true)
  }

  const openEditModal = (ch: NotificationChannel) => {
    setEditing(ch)
    setFormType(ch.type)
    setFormName(ch.name)
    setFormConfig(ch.config)
    setFormError('')
    setModal(true)
  }

  const handleToggle = async (ch: NotificationChannel) => {
    const previous = channels
    setChannels(channels.map(c => c.id === ch.id ? { ...c, is_active: !c.is_active } : c))
    try {
      await axios.patch(
        `http://localhost:8000/api/notification-channels/${ch.id}/toggle-active`,
        {},
        { headers }
      )
    } catch {
      setChannels(previous)
    }
  }

  const handleSubmit = async () => {
    if (!formName.trim()) { setFormError('El nombre es requerido.'); return }
    const fields = channelFields[formType]
    for (const f of fields) {
      if (f.type !== 'password' && !formConfig[f.key]?.trim()) {
        setFormError(`El campo "${f.label}" es requerido.`)
        return
      }
    }
    setSubmitting(true)
    setFormError('')
    try {
      if (editingChannel) {
        const res = await axios.put(
          `http://localhost:8000/api/notification-channels/${editingChannel.id}`,
          { type: formType, name: formName.trim(), config: formConfig },
          { headers }
        )
        setChannels(channels.map(c => c.id === editingChannel.id ? res.data : c))
      } else {
        const res = await axios.post(
          'http://localhost:8000/api/notification-channels',
          { type: formType, name: formName.trim(), config: formConfig },
          { headers }
        )
        setChannels([res.data, ...channels])
      }
      setModal(false)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setFormError(Object.values(errs).flat().join(' '))
      } else {
        setFormError('Error al guardar el canal.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `
    w-full bg-white/5 text-white placeholder-gray-600
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Canales de notificación</h1>
          <p className="text-sm text-gray-400 mt-1">Configurá cómo y dónde recibe tu equipo las alertas de Noctua</p>
        </div>
        {role === 'admin' && (
          <button
            onClick={openCreateModal}
            className="
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold px-5 py-2.5 rounded-lg
              transition-colors duration-200 glow-amber shrink-0
            "
          >
            + Nuevo canal
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl px-6 py-16 text-center bg-white/2">
          <p className="text-gray-500 text-sm">
            No hay canales configurados.{role === 'admin' ? ' Creá el primero con el botón de arriba.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {channels.map(ch => {
            const cfg = typeConfig[ch.type] ?? typeConfig.email
            return (
              <div
                key={ch.id}
                className="
                  rounded-2xl px-6 py-5 flex flex-col gap-4
                  border border-white/8 hover:border-white/15
                  transition-all duration-300 animate-list-item-enter
                "
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                      <span className={`text-base font-bold ${cfg.iconColor}`}>{cfg.icon}</span>
                    </div>
                    {/* Type badge + config label */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-500">{cfg.configLabel}</span>
                      </div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <ToggleSwitch
                    checked={ch.is_active}
                    onChange={() => handleToggle(ch)}
                    size="sm"
                  />
                </div>

                {/* Nombre */}
                <p className="text-base font-bold text-white">{ch.name}</p>

                {/* Footer: contador + botón configurar */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-gray-500">
                    {ch.notifications_count != null
                      ? `${ch.notifications_count} alertas esta semana`
                      : 'Sin actividad registrada'}
                  </span>
                  {role === 'admin' && (
                    <button
                      onClick={() => openEditModal(ch)}
                      className="
                        px-3 py-1.5 rounded-lg text-xs font-semibold
                        bg-white/8 hover:bg-white/12 text-gray-300 hover:text-white
                        border border-white/10 transition-colors duration-200
                      "
                    >
                      Configurar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModal(false)}
        title={editingChannel ? 'Configurar canal' : 'Nuevo canal'}
        subtitle={editingChannel ? 'Modificá la configuración de este canal.' : 'Conectá un nuevo canal de notificaciones.'}
        closeOnBackdropClick={false}
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {formError}
            </div>
          )}

          {/* Tipo (solo en creación) */}
          {!editingChannel && (
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Tipo de canal</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(channelFields) as ChannelType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setFormType(t); setFormConfig({}) }}
                    className={`
                      py-2.5 rounded-xl text-sm font-semibold border
                      transition-all duration-200
                      ${formType === t
                        ? 'bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)] border-[color:var(--color-noctua-amber)]/30'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-white'
                      }
                    `}
                  >
                    {typeConfig[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Nombre del canal</label>
            <input
              type="text"
              placeholder={formType === 'slack' ? '#alertas-prod' : formType === 'email' ? 'equipo@empresa.com' : '+57 316 000 0000'}
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Campos dinámicos según tipo */}
          {channelFields[formType].map(field => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className={labelClass}>{field.label}</label>
              <input
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                value={formConfig[field.key] ?? ''}
                onChange={e => setFormConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}

          {/* Botones */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setModal(false)}
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
              {submitting ? 'Guardando...' : editingChannel ? 'Guardar cambios' : 'Crear canal'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}