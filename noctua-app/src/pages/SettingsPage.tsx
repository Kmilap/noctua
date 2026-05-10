import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'
import ToggleSwitch from '../components/ToggleSwitch'

type Section = 'general' | 'notifications' | 'containers' | 'security'

export default function SettingsPage() {
  const { role } = usePermissions()
  const navigate = useNavigate()
  const [active, setActive] = useState<Section>('general')
  const [saved, setSaved] = useState(false)

  const load = (key: string, def: string) => localStorage.getItem('noctua_' + key) ?? def
  const loadBool = (key: string, def: boolean) => localStorage.getItem('noctua_' + key) !== null ? localStorage.getItem('noctua_' + key) === 'true' : def

  // General
  const [language, setLanguage] = useState(() => load('language', 'es'))
  const [theme, setTheme] = useState(() => load('theme', 'dark'))
  const [dateFormat, setDateFormat] = useState(() => load('dateFormat', 'relative'))

  // Notifications
  const [notifCritical, setNotifCritical] = useState(() => loadBool('notifCritical', true))
  const [notifWarning, setNotifWarning]   = useState(() => loadBool('notifWarning', true))
  const [notifDaily, setNotifDaily]       = useState(() => loadBool('notifDaily', false))
  const [notifSound, setNotifSound]       = useState(() => loadBool('notifSound', false))

  // Containers (admin only)
  const [maxContainers, setMaxContainers] = useState(() => load('maxContainers', '12'))
  const [healthCheck, setHealthCheck]     = useState(() => load('healthCheck', 'host.docker.internal'))

  // Security
  const [sessionTimeout, setSessionTimeout] = useState(() => load('sessionTimeout', '480'))
  const [requireConfirm, setRequireConfirm] = useState(() => loadBool('requireConfirm', true))

  const handleSave = () => {
    const settings: Record<string, string> = {
      language, theme, dateFormat,
      notifCritical: String(notifCritical),
      notifWarning: String(notifWarning),
      notifDaily: String(notifDaily),
      notifSound: String(notifSound),
      maxContainers, healthCheck, sessionTimeout,
      requireConfirm: String(requireConfirm),
    }
    Object.entries(settings).forEach(([k, v]) => localStorage.setItem('noctua_' + k, v))
    
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    {
      key: 'general',
      label: 'General',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    },
    {
      key: 'notifications',
      label: 'Notificaciones',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    },
    ...(role === 'admin' ? [{
      key: 'containers' as Section,
      label: 'Contenedores',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
    }] : []),
    {
      key: 'security',
      label: 'Seguridad',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
  ]

  const inputClass = "w-full bg-[#1a1828] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors duration-200 [&>option]:bg-[#1a1828] [&>option]:text-white"
  const labelClass = "text-xs font-semibold text-gray-400 uppercase tracking-wide"
  const rowClass = "flex items-center justify-between py-3 border-b border-white/5 last:border-0"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/profile')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all duration-200">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Configuración</h1>
          <p className="text-sm text-gray-400 mt-1">Personalizá tu experiencia en Noctua.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 items-start">
        {/* Sidebar de secciones */}
        <div className="col-span-1 rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActive(s.key)}
              className={'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 text-left border-b border-white/5 last:border-0 ' +
                (active === s.key
                  ? 'bg-[color:var(--color-noctua-amber)]/10 text-[color:var(--color-noctua-amber)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white')}>
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="col-span-3 rounded-2xl border border-white/8 p-6 flex flex-col gap-6"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>

          {/* General */}
          {active === 'general' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-white">Preferencias generales</h2>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Idioma</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className={inputClass}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Tema</label>
                <select value={theme} onChange={e => setTheme(e.target.value)} className={inputClass}>
                  <option value="dark">Oscuro (por defecto)</option>
                  <option value="light">Claro (próximamente)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Formato de fechas</label>
                <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={inputClass}>
                  <option value="relative">Relativo (hace 2 horas)</option>
                  <option value="absolute">Absoluto (10/05/2026 15:30)</option>
                </select>
              </div>
            </div>
          )}

          {/* Notificaciones */}
          {active === 'notifications' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-white">Preferencias de notificaciones</h2>
              <div className="flex flex-col">
                {[
                  { label: 'Incidentes críticos', sub: 'Recibí alertas inmediatas para severidad critical', val: notifCritical, set: setNotifCritical },
                  { label: 'Alertas de warning', sub: 'Notificaciones para severidad warning', val: notifWarning, set: setNotifWarning },
                  { label: 'Resumen diario', sub: 'Un email resumen cada día a las 8:00 AM', val: notifDaily, set: setNotifDaily },
                  { label: 'Sonido de alertas', sub: 'Reproducir sonido al recibir incidentes críticos', val: notifSound, set: setNotifSound },
                ].map(item => (
                  <div key={item.label} className={rowClass}>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                    </div>
                    <ToggleSwitch checked={item.val} onChange={() => item.set(!item.val)} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contenedores (admin) */}
          {active === 'containers' && role === 'admin' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-white">Límites de contenedores</h2>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Máximo de contenedores activos</label>
                <input type="number" value={maxContainers} onChange={e => setMaxContainers(e.target.value)}
                  min={1} max={50} className={inputClass + ' tabular-nums'} />
                <p className="text-xs text-gray-500">Recomendado: 6 para 2GB RAM, 12 para 4GB, 25 para 8GB.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Host de health check</label>
                <select value={healthCheck} onChange={e => setHealthCheck(e.target.value)} className={inputClass}>
                  <option value="host.docker.internal">host.docker.internal (WSL2 / macOS)</option>
                  <option value="localhost">localhost (Linux nativo)</option>
                  <option value="172.17.0.1">172.17.0.1 (Linux fallback)</option>
                </select>
              </div>
            </div>
          )}

          {/* Seguridad */}
          {active === 'security' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-white">Seguridad de sesión</h2>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Timeout de sesión (minutos)</label>
                <input type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}
                  min={30} max={1440} className={inputClass + ' tabular-nums'} />
              </div>
              <div className={rowClass}>
                <div>
                  <p className="text-sm font-medium text-white">Confirmar acciones destructivas</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pedir confirmación al eliminar servicios o contenedores</p>
                </div>
                <ToggleSwitch checked={requireConfirm} onChange={() => setRequireConfirm(!requireConfirm)} size="sm" />
              </div>
            </div>
          )}

          {/* Guardar */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/8">
            {saved && (
              <span className="text-sm text-emerald-400 font-medium">✓ Configuración guardada</span>
            )}
            <button onClick={handleSave}
              className="ml-auto px-5 py-2.5 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200">
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}