import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useNavigate, Link } from 'react-router-dom'
import ToggleSwitch from '../components/ToggleSwitch'

export default function ProfilePage() {
  const { token, user } = useAuth()
  const { role } = usePermissions()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const headers = { Authorization: `Bearer ${token}` }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const rolLabel = role === 'admin' ? 'Admin' : role === 'operator' ? 'Operator' : 'Viewer'

  // Form state — precargado con datos del usuario
  const [nombre, setNombre]       = useState(user?.name?.split(' ')[0] ?? '')
  const [apellido, setApellido]   = useState(user?.name?.split(' ').slice(1).join(' ') ?? '')
  const [email, setEmail]         = useState(user?.email ?? '')
  const [cargo, setCargo]         = useState('')
  const [passActual, setPassActual]   = useState('')
  const [passNueva, setPassNueva]     = useState('')
  const [passConfirm, setPassConfirm] = useState('')

  const [showPassActual, setShowPassActual]   = useState(false)
  const [showPassNueva, setShowPassNueva]     = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)

  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [deletePassword, setDeletePassword]       = useState('')
  const [deleteError, setDeleteError]             = useState('')

  // Notificaciones — persisted independently of the profile form
  const [notifs, setNotifs] = useState<{ critical: boolean; warning: boolean; daily: boolean; updates: boolean }>(() => {
    try {
      const saved = localStorage.getItem('noctua_notifs')
      return saved ? JSON.parse(saved) : { critical: true, warning: true, daily: false, updates: false }
    } catch {
      return { critical: true, warning: true, daily: false, updates: false }
    }
  })

  // Auto-persist every time a toggle changes — independent of "Guardar cambios"
  useEffect(() => {
    localStorage.setItem('noctua_notifs', JSON.stringify(notifs))
  }, [notifs])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    // Validación básica de contraseña
    if (passNueva && passNueva !== passConfirm) {
      setError(t('profile.error_passwords'))
      setSaving(false)
      return
    }
    
    try {
      const payload: any = { name: `${nombre} ${apellido}`.trim(), email }
      if (passNueva) {
        payload.current_password = passActual
        payload.password = passNueva
        payload.password_confirmation = passConfirm
      }

      await axios.patch('http://localhost:8000/api/user/profile', payload, { headers })
      setSuccess(t('profile.success'))
      setPassActual(''); setPassNueva(''); setPassConfirm('')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setError(Object.values(errs).flat().join(' '))
      } else {
        setError(t('profile.error_save'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await axios.post('http://localhost:8000/api/logout', {}, { headers })
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleDeactivate = async () => {
    setSaving(true)
    try {
      await axios.post('http://localhost:8000/api/account/deactivate', {}, { headers })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
    } catch {
      setError(t('profile.error_deactivate'))
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deletePassword) { setDeleteError(t('profile.error_password_required')); return }
    setSaving(true)
    setDeleteError('')
    try {
      await axios.delete('http://localhost:8000/api/account', {
        headers,
        data: { password: deletePassword }
      })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setDeleteError(err.response.data.message)
      } else {
        setDeleteError(t('profile.error_delete'))
      }
    } finally { setSaving(false) }
  }

  const inputClass = `
    w-full bg-white/5 text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200
  `
  const labelClass = 'text-xs font-semibold text-gray-400 uppercase tracking-wide'
  const sectionClass = 'rounded-2xl border border-white/8 p-6 flex flex-col gap-5'
  const sectionStyle = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('profile.title')}</h1>
          <Link to="/app/settings" className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 border border-white/8 hover:border-white/15 transition-all duration-200" title={t('nav.settings')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" style={{display:'none'}}/>
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-1">{t('profile.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Columna izquierda — formulario principal */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Feedback */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-3">{success}</div>
          )}

          {/* Avatar + rol */}
          <div className={sectionClass} style={sectionStyle}>
            <div className="flex items-center gap-5">
              <div className="
                w-16 h-16 rounded-full shrink-0
                bg-[color:var(--color-noctua-amber)]/20
                border-2 border-[color:var(--color-noctua-amber)]/40
                flex items-center justify-center
                text-xl font-bold text-[color:var(--color-noctua-amber)]
              ">
                {initials}
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)] border border-[color:var(--color-noctua-amber)]/20 mb-2">
                  {rolLabel}
                </span>
                <button className="block text-sm text-gray-400 hover:text-white transition-colors duration-200">
                  {t('profile.change_avatar')}
                </button>
              </div>
            </div>
          </div>

          {/* Información personal */}
          <div className={sectionClass} style={sectionStyle}>
            <h2 className="text-base font-semibold text-white">{t('profile.personal_info')}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t('profile.first_name')}</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t('profile.last_name')}</label>
                <input type="text" value={apellido} onChange={e => setApellido(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('profile.email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('profile.job_title')}</label>
              <input
                type="text"
                placeholder={t('profile.job_placeholder')}
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Seguridad */}
          <div className={sectionClass} style={sectionStyle}>
            <h2 className="text-base font-semibold text-white">{t('profile.security')}</h2>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('profile.current_password')}</label>
              <div className="relative">
                <input type={showPassActual ? 'text' : 'password'} placeholder="••••••••" value={passActual} onChange={e => setPassActual(e.target.value)} className={inputClass + ' pr-10'} />
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setShowPassActual(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                  {showPassActual ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t('profile.new_password')}</label>
                <div className="relative">
                  <input type={showPassNueva ? 'text' : 'password'} placeholder="••••••••" value={passNueva} onChange={e => setPassNueva(e.target.value)} className={inputClass + ' pr-10'} />
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setShowPassNueva(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                    {showPassNueva ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t('profile.confirm_password')}</label>
                <div className="relative">
                  <input type={showPassConfirm ? 'text' : 'password'} placeholder="••••••••" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} className={inputClass + ' pr-10'} />
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setShowPassConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                    {showPassConfirm ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="
              w-full py-3.5 rounded-xl
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-bold text-sm
              transition-colors duration-200 glow-amber
              disabled:opacity-50
            "
          >
            {saving ? t('profile.saving') : t('profile.save_changes')}
          </button>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-5">

          {/* Zona de peligro */}
          <div className={sectionClass} style={{ ...sectionStyle, borderColor: 'rgba(239,68,68,0.2)' }}>
            <div>
              <h2 className="text-base font-semibold text-white">{t('profile.danger_zone')}</h2>
              <p className="text-xs text-gray-500 mt-1">{t('profile.danger_zone_hint')}</p>
            </div>
            
            <button onClick={handleLogout}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors duration-200">
              {t('profile.logout')}
            </button>

            {!confirmDeactivate ? (
              <button onClick={() => setConfirmDeactivate(true)}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors duration-200">
                {t('profile.deactivate')}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-400">{t('profile.reactivation_hint')}</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeactivate(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-400 bg-white/5 border border-white/10 transition-colors">
                    {t('profile.cancel')}
                  </button>
                  <button onClick={handleDeactivate} disabled={saving}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50">
                    {saving ? t('profile.processing') : t('profile.confirm')}
                  </button>
                </div>
              </div>
            )}

            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-red-600/20 border border-red-600/40 text-red-300 hover:bg-red-600/30 transition-colors duration-200">
                {t('profile.delete')}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <input type="password" placeholder={t('profile.delete_confirm_placeholder')} value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm outline-none border border-red-500/30 focus:border-red-500/60 transition-colors" />
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError('') }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-400 bg-white/5 border border-white/10 transition-colors">
                    {t('profile.cancel')}
                  </button>
                  <button onClick={handleDelete} disabled={saving}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
                    {saving ? t('profile.deleting') : t('profile.delete_permanently')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notificaciones */}
          <div className={sectionClass} style={sectionStyle}>
            <div>
              <h2 className="text-base font-semibold text-white">{t('profile.notifications_title')}</h2>
              <p className="text-xs text-gray-500 mt-1">{t('profile.notifications_hint')}</p>
            </div>
            {[
              { key: 'critical', label: t('profile.notif_critical') },
              { key: 'warning',  label: t('profile.notif_warning') },
              { key: 'daily',    label: t('profile.notif_daily') },
              { key: 'updates',  label: t('profile.notif_updates') },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{item.label}</span>
                <ToggleSwitch
                  checked={notifs[item.key as keyof typeof notifs]}
                  onChange={(v) => setNotifs(n => ({ ...n, [item.key]: v }))}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}