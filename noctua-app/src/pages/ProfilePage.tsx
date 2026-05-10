import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useNavigate, Link } from 'react-router-dom'
import ToggleSwitch from '../components/ToggleSwitch'

export default function ProfilePage() {
  const { token, user, login } = useAuth()
  const { role } = usePermissions()
  const navigate = useNavigate()
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

  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  // Notificaciones (UI only por ahora — backend no tiene el endpoint)
  const [notifs, setNotifs] = useState({
    critical: true,
    warning: true,
    daily: false,
    updates: false,
  })

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    // Validación básica de contraseña
    if (passNueva && passNueva !== passConfirm) {
      setError('Las contraseñas nuevas no coinciden.')
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
      setSuccess('Perfil actualizado correctamente.')
      setPassActual(''); setPassNueva(''); setPassConfirm('')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setError(Object.values(errs).flat().join(' '))
      } else {
        setError('No se pudo guardar. Intentá de nuevo.')
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Editar perfil</h1>
          <Link to="/settings" className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 border border-white/8 hover:border-white/15 transition-all duration-200" title="Configuración">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" style={{display:'none'}}/>
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-1">Actualizá tu información personal y preferencias de cuenta.</p>
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
                  Cambiar avatar
                </button>
              </div>
            </div>
          </div>

          {/* Información personal */}
          <div className={sectionClass} style={sectionStyle}>
            <h2 className="text-base font-semibold text-white">Información personal</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Nombre</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Apellido</label>
                <input type="text" value={apellido} onChange={e => setApellido(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Cargo / Rol en el equipo</label>
              <input
                type="text"
                placeholder="ej. Líder técnica"
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Seguridad */}
          <div className={sectionClass} style={sectionStyle}>
            <h2 className="text-base font-semibold text-white">Seguridad</h2>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Contraseña actual</label>
              <input type="password" placeholder="••••••••" value={passActual} onChange={e => setPassActual(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Nueva contraseña</label>
                <input type="password" placeholder="••••••••" value={passNueva} onChange={e => setPassNueva(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Confirmar contraseña</label>
                <input type="password" placeholder="••••••••" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} className={inputClass} />
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
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-5">

          {/* Zona de peligro */}
          <div className={sectionClass} style={{ ...sectionStyle, borderColor: 'rgba(239,68,68,0.2)' }}>
            <div>
              <h2 className="text-base font-semibold text-white">Zona de peligro</h2>
              <p className="text-xs text-gray-500 mt-1">Estas acciones son irreversibles.</p>
            </div>
            <button
              onClick={handleLogout}
              className="
                w-full py-2.5 rounded-xl text-sm font-semibold
                border border-red-500/30 text-red-400
                hover:bg-red-500/10 transition-colors duration-200
              "
            >
              Cerrar sesión
            </button>
            <button className="
              w-full py-2.5 rounded-xl text-sm font-bold
              bg-red-500/15 border border-red-500/30 text-red-400
              hover:bg-red-500/25 transition-colors duration-200
            ">
              Desactivar cuenta
            </button>
            <button className="
              w-full py-2.5 rounded-xl text-sm font-bold
              bg-red-600/20 border border-red-600/40 text-red-300
              hover:bg-red-600/30 transition-colors duration-200
            ">
              Eliminar cuenta permanentemente
            </button>
          </div>

          {/* Notificaciones */}
          <div className={sectionClass} style={sectionStyle}>
            <div>
              <h2 className="text-base font-semibold text-white">Notificaciones</h2>
              <p className="text-xs text-gray-500 mt-1">Elegí cómo y cuándo te avisamos.</p>
            </div>
            {[
              { key: 'critical', label: 'Incidentes críticos' },
              { key: 'warning',  label: 'Alertas de warning' },
              { key: 'daily',    label: 'Resumen diario' },
              { key: 'updates',  label: 'Actualizaciones del producto' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{item.label}</span>
                <ToggleSwitch
                  checked={notifs[item.key as keyof typeof notifs]}
                  onChange={() => setNotifs(n => ({ ...n, [item.key]: !n[item.key as keyof typeof notifs] }))}
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