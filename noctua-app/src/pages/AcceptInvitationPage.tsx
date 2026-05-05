import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const roleConfig = {
  admin:    { label: 'Admin',    dot: 'bg-[color:var(--color-noctua-amber)]', text: 'text-[color:var(--color-noctua-amber)]' },
  operator: { label: 'Operator', dot: 'bg-violet-400',  text: 'text-violet-400' },
  viewer:   { label: 'Viewer',   dot: 'bg-blue-400',    text: 'text-blue-400' },
}

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()

  // En producción estos datos vendrían del token de la URL
  // Por ahora los leemos de query params o usamos defaults para demo
  const emailFromUrl = searchParams.get('email') ?? 'nmendez@unab.edu.co'
  const nameFromUrl  = searchParams.get('name')  ?? 'Noel Santiago Méndez Jaimes'
  const teamFromUrl  = searchParams.get('team')  ?? 'Noctua Dev Team'
  const roleFromUrl  = (searchParams.get('role') ?? 'operator') as keyof typeof roleConfig

  const [name, setName]         = useState(nameFromUrl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  const roleCfg = roleConfig[roleFromUrl] ?? roleConfig.operator

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 8)  { setError('Mínimo 8 caracteres.'); return }
    setLoading(true)
    setError('')
    try {
      // UI only — integración real pendiente de backend
      await new Promise(r => setTimeout(r, 900))
      setDone(true)
      setTimeout(() => { window.location.href = '/login' }, 2000)
    } catch {
      setError('Error al aceptar la invitación. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `
    w-full bg-white/5 text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200
  `
  const labelClass = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block'

  if (done) {
    return (
      <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex items-center justify-center overflow-hidden">
        <AuroraBackground />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <div
            className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"
            style={{ animation: 'scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">¡Ya sos parte del equipo!</h2>
            <p className="text-sm text-gray-400 mt-2">Redirigiendo al inicio de sesión...</p>
          </div>
          <style>{`
            @keyframes scale-in {
              from { transform: scale(0.5); opacity: 0; }
              to   { transform: scale(1);   opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex overflow-hidden">
      <AuroraBackground />

      {/* Blob teal específico de esta página */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: '500px',
            height: '500px',
            bottom: '-10%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, rgba(20,184,166,0) 70%)',
            filter: 'blur(60px)',
            animation: 'aurora-float-2 18s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '400px',
            height: '400px',
            top: '10%',
            right: '5%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0) 70%)',
            filter: 'blur(70px)',
            animation: 'aurora-float-3 22s ease-in-out infinite',
          }}
        />
      </div>

      {/* Izquierda */}
      <div
        className="relative z-10 w-[520px] shrink-0 flex flex-col justify-between p-14 border-r border-white/8"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        {/* Logo */}
        <h1 className="text-4xl font-bold tracking-tight text-white">
          n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
        </h1>

        {/* Mensaje de bienvenida */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-4xl font-bold text-white leading-tight">
              Bienvenido<br />
              <span style={{ color: '#14b8a6' }}>al equipo.</span>
            </p>
            <p className="mt-4 text-base leading-relaxed" style={{ color: '#5eead4' }}>
              Tu invitación está lista.<br />
              Completá tus datos y empezá<br />a monitorear.
            </p>
          </div>

          {/* Card del equipo */}
          <div className="bg-white/5 rounded-2xl px-5 py-4 flex items-center gap-3" style={{ border: '1px solid rgba(20,184,166,0.25)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#14b8a6' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{teamFromUrl}</p>
              <p className="text-xs text-gray-500">Equipo al que te unís</p>
            </div>
          </div>

          {/* Badge de rol */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Rol:</span>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#14b8a6' }} />
              <span className="text-sm font-semibold" style={{ color: '#14b8a6' }}>{roleCfg.label}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600">Noctua v1.0 — Hecho en Bucaramanga, Colombia</p>
      </div>

      {/* Derecha */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center p-8"
        style={{
          background: 'rgba(15, 14, 23, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div
          className="w-full max-w-lg rounded-3xl p-8 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}
        >
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white tracking-tight">Completá tu cuenta</h2>
            <p className="text-sm text-gray-400 mt-1">Solo te pedimos lo esencial para empezar.</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email — prellenado y bloqueado */}
            <div>
              <label className={labelClass}>Correo electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  value={emailFromUrl}
                  readOnly
                  className={inputClass + ' pr-24 opacity-70 cursor-not-allowed'}
                />
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--color-noctua-amber)] bg-[color:var(--color-noctua-amber)]/10 px-2 py-0.5 rounded-md border border-[color:var(--color-noctua-amber)]/20">
                  prellenado
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Nombre completo */}
            <div>
              <label className={labelClass}>Nombre completo</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass + ' pr-8'}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className={labelClass}>Crear contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass + ' pr-16'}
                  required
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPass} />
                </button>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className={labelClass}>Confirmar contraseña</label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputClass + ' pr-16'}
                  required
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowConf(s => !s)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showConf} />
                </button>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Submit — color teal como en el Figma */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5 rounded-xl mt-2
                font-bold text-sm text-black
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              style={{
                background: loading ? '#0d9488' : '#14b8a6',
                boxShadow: '0 0 20px rgba(20,184,166,0.25)',
              }}
            >
              {loading ? 'Uniéndome...' : 'Aceptar invitación y unirme'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            Al unirte aceptás los{' '}
            <span className="text-gray-400 hover:text-white cursor-pointer transition-colors">
              términos de uso de Noctua
            </span>.
          </p>
        </div>
      </div>
    </div>
  )
}