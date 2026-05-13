import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import AuroraBackground from '../components/AuroraBackground'
import { useAuth } from '../hooks/useAuth'

const steps = [
  { num: '01', label: 'Registra tu cuenta' },
  { num: '02', label: 'Agrega tus servicios' },
  { num: '03', label: 'Configura tus alertas' },
]

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

function PasswordField({
  label,
  value,
  onChange,
  placeholder = '••••••••',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="
            w-full bg-white/5 text-white placeholder-gray-600
            rounded-xl px-4 py-3 text-sm outline-none
            border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
            transition-colors duration-200 pr-16
          "
          required
        />
        {/* Botón ojo — siempre visible */}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setShow(s => !s)}
          className="
            absolute right-8 top-1/2 -translate-y-1/2
            text-gray-500 hover:text-gray-300
            transition-colors duration-200
            focus:outline-none
          "
          tabIndex={-1}
        >
          <EyeIcon open={show} />
        </button>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
      </div>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Segura']
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-400']
  const textColors = ['', 'text-red-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400']

  if (!password) return null

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>
      )}
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [passConfirm, setPassConfirm] = useState('')
  const [teamName, setTeamName]       = useState('')
  const [terms, setTerms]             = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!terms)                    { setError('Aceptá los términos y condiciones para continuar.'); return }
    if (password !== passConfirm)  { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 8)       { setError('La contraseña debe tener al menos 8 caracteres.'); return }

    setLoading(true)
    setError('')
    try {
      // Registrar al usuario
      await axios.post('http://localhost:8000/api/register', {
        name,
        email,
        password,
        password_confirmation: passConfirm,
        team_name: teamName || undefined,
      })

      // Iniciar sesión de manera automática
      
      await login(email, password)
      navigate('/app/dashboard')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setError(Object.values(errs).flat().join(' '))
      } else {
        setError('Error al crear la cuenta. Intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `
    w-full bg-white/5 text-white placeholder-gray-600
    rounded-xl px-4 py-3 text-sm outline-none
    border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60
    transition-colors duration-200 pr-8
  `
  const labelClass = 'text-xs font-semibold text-gray-400 mb-1.5 block'

  return (
    <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex overflow-hidden">
      <AuroraBackground />

      {/* Izquierda */}
      <div
        className="relative z-10 w-[540px] shrink-0 flex flex-col justify-between p-14 border-r border-white/8"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-6">
            n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
          </h1>
          <p className="text-3xl font-bold text-white leading-tight">
            Empieza a{' '}
            <span className="text-[color:var(--color-noctua-amber)]">monitorear.</span>
          </p>
          <p className="text-gray-400 mt-3 text-base">
            Registrá tu equipo y tus servicios<br />en menos de 5 minutos.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-4 bg-white/5 border border-white/8 rounded-2xl px-5 py-3.5"
            >
              <span className="text-xs font-bold text-[color:var(--color-noctua-amber)] w-6 shrink-0">
                {s.num}
              </span>
              <div className="w-px h-4 bg-white/15" />
              <span className="text-sm font-medium text-gray-300">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">Noctua v1.0 — Hecho en Bucaramanga, Colombia</p>
          <p className="text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-[color:var(--color-noctua-amber)] font-semibold hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>
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
            <h2 className="text-2xl font-bold text-white tracking-tight">Crear cuenta</h2>
            <p className="text-sm text-gray-400 mt-1">Completa los datos para empezar a monitorear.</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Nombre completo */}
            <div>
              <label className={labelClass}>Nombre completo</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nicole Camila Niño"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Correo */}
            <div>
              <label className={labelClass}>Correo electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="tu@equipo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Contraseñas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <PasswordField
                  label="Contraseña"
                  value={password}
                  onChange={setPassword}
                />
                <PasswordStrength password={password} />
              </div>
              <PasswordField
                label="Confirmar contraseña"
                value={passConfirm}
                onChange={setPassConfirm}
              />
            </div>

            {/* Nombre del equipo */}
            <div>
              <label className={labelClass}>Nombre del equipo</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="noctua-dev"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className={inputClass}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            {/* Términos */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setTerms(!terms)}
                className={`
                  w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
                  transition-all duration-200
                  ${terms
                    ? 'bg-[color:var(--color-noctua-amber)] border-[color:var(--color-noctua-amber)]'
                    : 'border-white/20 bg-white/5 group-hover:border-white/40'
                  }
                `}
              >
                {terms && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-400">
                Acepto los{' '}
                <span className="text-[color:var(--color-noctua-amber)] hover:underline cursor-pointer">
                  términos y condiciones de uso
                </span>.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5 rounded-xl mt-1
                bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
                text-black font-bold text-sm
                transition-colors duration-200 glow-amber
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-5">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-[color:var(--color-noctua-amber)] font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}