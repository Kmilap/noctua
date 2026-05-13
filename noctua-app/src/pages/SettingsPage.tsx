import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { usePermissions } from '../hooks/usePermissions'
import ToggleSwitch from '../components/ToggleSwitch'

type Section = 'general' | 'notifications' | 'containers' | 'security'

// Module-level helpers so they can be called outside the component (handleDiscard, dirty)
const NS = 'noctua_'
const load = (key: string, def: string) => localStorage.getItem(NS + key) ?? def
const loadBool = (key: string, def: boolean) =>
  localStorage.getItem(NS + key) !== null
    ? localStorage.getItem(NS + key) === 'true'
    : def

// Short beep via Web Audio API — no external dep required
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* AudioContext unavailable (tests, old browsers) */ }
}

export default function SettingsPage() {
  const { role } = usePermissions()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const [active, setActive] = useState<Section>('general')
  const [saved,  setSaved]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // ── State ──────────────────────────────────────────────────────────────────
  // General
  const [language,   setLanguage]   = useState(() => load('language', 'es'))
  const [theme,      setTheme]      = useState(() => load('theme', 'dark'))
  const [dateFormat, setDateFormat] = useState(() => load('dateFormat', 'relative'))

  // Notifications
  const [notifCritical, setNotifCritical] = useState(() => loadBool('notifCritical', true))
  const [notifWarning,  setNotifWarning]  = useState(() => loadBool('notifWarning',  true))
  const [notifDaily,    setNotifDaily]    = useState(() => loadBool('notifDaily',    false))
  const [notifSound,    setNotifSound]    = useState(() => loadBool('notifSound',    false))

  // Containers (admin only)
  const [maxContainers, setMaxContainers] = useState(() => load('maxContainers', '12'))
  const [healthCheck,   setHealthCheck]   = useState(() => load('healthCheck', 'host.docker.internal'))

  // Security
  const [sessionTimeout, setSessionTimeout] = useState(() => load('sessionTimeout', '480'))
  const [requireConfirm, setRequireConfirm] = useState(() => loadBool('requireConfirm', true))

  // ── Side effects ───────────────────────────────────────────────────────────
  // Apply theme to the document immediately so the user sees the change live
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Change app language immediately on selector change — no page reload needed
  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language])

  // ── Derived state ──────────────────────────────────────────────────────────
  // Dirty: compare live state to what is currently persisted in localStorage.
  // After handleSave writes to localStorage, dirty naturally becomes false on
  // next render because the values now match. No extra state needed.
  const dirty =
    language       !== load('language', 'es')                           ||
    theme          !== load('theme', 'dark')                            ||
    dateFormat     !== load('dateFormat', 'relative')                   ||
    notifCritical  !== loadBool('notifCritical', true)                  ||
    notifWarning   !== loadBool('notifWarning',  true)                  ||
    notifDaily     !== loadBool('notifDaily',    false)                 ||
    notifSound     !== loadBool('notifSound',    false)                 ||
    maxContainers  !== load('maxContainers', '12')                      ||
    healthCheck    !== load('healthCheck', 'host.docker.internal')      ||
    sessionTimeout !== load('sessionTimeout', '480')                    ||
    requireConfirm !== loadBool('requireConfirm', true)

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('')

    // Validate: maxContainers
    const mc = parseInt(maxContainers, 10)
    if (role === 'admin' && (isNaN(mc) || mc < 1 || mc > 50)) {
      setError(t('settings.error_max_containers'))
      setActive('containers')
      return
    }

    // Validate: sessionTimeout
    const st = parseInt(sessionTimeout, 10)
    if (isNaN(st) || st < 30 || st > 1440) {
      setError(t('settings.error_timeout'))
      setActive('security')
      return
    }

    setSaving(true)
    try {
      // Settings are localStorage-only; brief delay for perceived async feedback
      await new Promise(r => setTimeout(r, 380))
      const settings: Record<string, string> = {
        language, theme, dateFormat,
        notifCritical:  String(notifCritical),
        notifWarning:   String(notifWarning),
        notifDaily:     String(notifDaily),
        notifSound:     String(notifSound),
        maxContainers, healthCheck, sessionTimeout,
        requireConfirm: String(requireConfirm),
      }
      Object.entries(settings).forEach(([k, v]) => localStorage.setItem(NS + k, v))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('settings.error_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // Revert all fields to the last persisted values (i.e. discard unsaved edits)
  const handleDiscard = () => {
    setLanguage(load('language', 'es'))
    setTheme(load('theme', 'dark'))
    setDateFormat(load('dateFormat', 'relative'))
    setNotifCritical(loadBool('notifCritical', true))
    setNotifWarning(loadBool('notifWarning',   true))
    setNotifDaily(loadBool('notifDaily',       false))
    setNotifSound(loadBool('notifSound',       false))
    setMaxContainers(load('maxContainers', '12'))
    setHealthCheck(load('healthCheck', 'host.docker.internal'))
    setSessionTimeout(load('sessionTimeout', '480'))
    setRequireConfirm(loadBool('requireConfirm', true))
    setError('')
  }

  // Toggling sound ON immediately plays the beep so the user hears what it sounds like
  const handleNotifSoundChange = (v: boolean) => {
    setNotifSound(v)
    if (v) playBeep()
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  const stMin = parseInt(sessionTimeout, 10) || 480
  const timeoutLabel = stMin >= 60
    ? `${Math.floor(stMin / 60)}h${stMin % 60 > 0 ? ` ${stMin % 60}min` : ''}`
    : `${stMin} min`

  const containerHint = (() => {
    const n = parseInt(maxContainers, 10)
    if (isNaN(n) || n < 1) return t('settings.container_hint_range')
    if (n <= 6)  return t('settings.container_hint_2gb')
    if (n <= 12) return t('settings.container_hint_4gb')
    if (n <= 25) return t('settings.container_hint_8gb')
    if (n <= 50) return t('settings.container_hint_high')
    return t('settings.container_hint_max')
  })()

  const nowStr = new Date().toLocaleString(language, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // ── Sections nav ───────────────────────────────────────────────────────────
  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    {
      key: 'general',
      label: t('settings.section_general'),
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    },
    {
      key: 'notifications',
      label: t('settings.section_notifications'),
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    },
    ...(role === 'admin' ? [{
      key: 'containers' as Section,
      label: t('settings.section_containers'),
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
    }] : []),
    {
      key: 'security',
      label: t('settings.section_security'),
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
  ]

  const inputClass = "w-full bg-[#1a1828] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors duration-200 [&>option]:bg-[#1a1828] [&>option]:text-white"
  const labelClass = "text-xs font-semibold text-gray-400 uppercase tracking-wide"
  const rowClass   = "flex items-center justify-between py-3 border-b border-white/5 last:border-0"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/profile')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all duration-200">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold tesxt-white tracking-tight">{t('settings.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 items-start">
        {/* ── Sidebar de secciones ── */}
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

        {/* ── Panel de contenido ── */}
        <div className="col-span-3 rounded-2xl border border-white/8 p-6 flex flex-col gap-6"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>

          {/* Error feedback */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Section content — animated on tab switch */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              {/* ── General ── */}
              {active === 'general' && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-base font-semibold text-white">{t('settings.general_title')}</h2>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.language_label')}</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className={inputClass}>
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.theme_label')}</label>
                    <select value={theme} onChange={e => setTheme(e.target.value)} className={inputClass}>
                      <option value="dark">{t('settings.theme_dark')}</option>
                      <option value="light">{t('settings.theme_light')}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.date_format_label')}</label>
                    <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={inputClass}>
                      <option value="relative">{t('settings.date_relative')}</option>
                      <option value="absolute">{t('settings.date_absolute')}</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {t('settings.date_preview')}{' '}
                      <span className="text-gray-400 font-medium">
                        {dateFormat === 'relative' ? t('settings.date_example_relative') : nowStr}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* ── Notificaciones ── */}
              {active === 'notifications' && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-base font-semibold text-white">{t('settings.notif_title')}</h2>
                  <div className="flex flex-col">
                    {([
                      { label: t('settings.notif_critical'), sub: t('settings.notif_critical_sub'), val: notifCritical, set: setNotifCritical },
                      { label: t('settings.notif_warning'),  sub: t('settings.notif_warning_sub'),  val: notifWarning,  set: setNotifWarning  },
                      { label: t('settings.notif_daily'),    sub: t('settings.notif_daily_sub'),    val: notifDaily,    set: setNotifDaily    },
                      { label: t('settings.notif_sound'),    sub: t('settings.notif_sound_sub'),    val: notifSound,    set: handleNotifSoundChange },
                    ] as { label: string; sub: string; val: boolean; set: (v: boolean) => void }[]).map(item => (
                      <div key={item.label} className={rowClass}>
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                        </div>
                        <ToggleSwitch checked={item.val} onChange={item.set} size="sm" />
                      </div>
                    ))}
                  </div>

                  {/* Sound test — only visible when sound is enabled */}
                  <AnimatePresence>
                    {notifSound && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <button
                          type="button"
                          onClick={playBeep}
                          className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors duration-200 flex items-center gap-1.5"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          {t('settings.test_sound')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Contenedores (admin) ── */}
              {active === 'containers' && role === 'admin' && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-base font-semibold text-white">{t('settings.containers_title')}</h2>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.max_containers_label')}</label>
                    <input
                      type="number"
                      value={maxContainers}
                      onChange={e => setMaxContainers(e.target.value)}
                      min={1} max={50}
                      className={inputClass + ' tabular-nums'}
                    />
                    <p className="text-xs text-gray-500">{containerHint}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.health_check_label')}</label>
                    <select value={healthCheck} onChange={e => setHealthCheck(e.target.value)} className={inputClass}>
                      <option value="host.docker.internal">host.docker.internal (WSL2 / macOS)</option>
                      <option value="localhost">localhost (Linux nativo)</option>
                      <option value="172.17.0.1">172.17.0.1 (Linux fallback)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ── Seguridad ── */}
              {active === 'security' && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-base font-semibold text-white">{t('settings.security_title')}</h2>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>{t('settings.timeout_label')}</label>
                    <input
                      type="number"
                      value={sessionTimeout}
                      onChange={e => setSessionTimeout(e.target.value)}
                      min={30} max={1440}
                      className={inputClass + ' tabular-nums'}
                    />
                    <p className="text-xs text-gray-500">
                      {t('settings.timeout_hint_prefix')}{' '}
                      <span className="text-gray-400 font-medium">{timeoutLabel}</span>{' '}
                      {t('settings.timeout_hint_suffix')}
                    </p>
                  </div>

                  <div className={rowClass}>
                    <div>
                      <p className="text-sm font-medium text-white">{t('settings.confirm_actions')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t('settings.confirm_actions_sub')}</p>
                    </div>
                    <ToggleSwitch checked={requireConfirm} onChange={setRequireConfirm} size="sm" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Footer: status + actions ── */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/8">
            {/* Left: transient status message */}
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.span
                  key="saved"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-emerald-400 font-medium flex items-center gap-1.5"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {t('settings.footer_saved')}
                </motion.span>
              ) : dirty ? (
                <motion.span
                  key="dirty"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-amber-400/70 font-medium"
                >
                  {t('settings.footer_unsaved')}
                </motion.span>
              ) : null}
            </AnimatePresence>

            {/* Right: discard + save */}
            <div className="ml-auto flex gap-2">
              <AnimatePresence>
                {dirty && !saving && (
                  <motion.button
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={handleDiscard}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/8 transition-colors duration-200"
                  >
                    {t('settings.footer_discard')}
                  </motion.button>
                )}
              </AnimatePresence>

              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {saving ? t('settings.footer_saving') : t('settings.footer_save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
