import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuroraBackground from '../components/AuroraBackground'

const features = [
  { icon: '🟡', text: 'Monitoreo en tiempo real' },
  { icon: '⚡', text: 'Alertas sin falsos positivos' },
  { icon: '🟡', text: 'Setup en 30 segundos' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Credenciales incorrectas. Verificá tu correo y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `
    w-full bg-white/5 text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200 pr-10
  `

  return (
    <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex overflow-hidden">
      <AuroraBackground />

      {/* Izquierda — branding + features */}
      <div
        className="relative z-10 flex-1 flex flex-col justify-between p-12 lg:p-16 border-r border-white/8"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white">
            n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
          </h1>
          <p className="text-gray-400 mt-3 text-lg">Vigila mientras dormís.</p>
          <div className="w-10 h-0.5 bg-[color:var(--color-noctua-amber)] mt-3 rounded-full" />
        </div>

        <div className="flex flex-col gap-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="
                inline-flex items-center gap-3
                bg-white/5 border border-white/8
                rounded-2xl px-5 py-3 w-full max-w-xs
                backdrop-blur-sm
              "
            >
              <span className="text-base">{f.icon}</span>
              <span className="text-sm font-medium text-gray-300">{f.text}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600">
          Noctua v1.0 — Hecho en Bucaramanga, Colombia
        </p>
      </div>

      {/* Derecha — formulario */}
      <div
        className="relative z-10 flex items-center justify-center w-full max-w-lg p-8"
        style={{
          background: 'rgba(15, 14, 23, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div
          className="w-full rounded-3xl p-8 border border-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Iniciar sesión</h2>
            <p className="text-sm text-gray-400 mt-1">Ingresá tus credenciales para acceder a Noctua</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="tu@equipo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
              <button
                type="button"
                className="text-xs text-[color:var(--color-noctua-amber)] hover:underline text-left mt-1 w-fit"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5 rounded-xl
                bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
                text-black font-bold text-sm
                transition-colors duration-200
                glow-amber
                disabled:opacity-50 disabled:cursor-not-allowed
                mt-2
              "
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            ¿No tenés cuenta?{' '}
            <Link
              to="/register"
              className="text-[color:var(--color-noctua-amber)] font-semibold hover:underline"
            >
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}