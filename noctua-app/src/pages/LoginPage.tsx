import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { usePageTransition } from '../hooks/usePageTransition'
import axios from 'axios'
import AuroraBackground from '../components/AuroraBackground'
import NoctuaLoader from '../components/NoctuaLoader'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const navigate              = useNavigate()
  const { login }             = useAuth()
  const { t }                 = useTranslation()
  const { navTo, pageStyle }  = usePageTransition()

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [deactivated, setDeactivated] = useState(false)
  const [resending, setResending]     = useState(false)
  const [resendEmail]                 = useState('')
  const [success, setSuccess]         = useState(false)

  const handleResendReactivation = async () => {
    setResending(true)
    try {
      await axios.post('http://localhost:8000/api/account/resend-reactivation', { email: resendEmail || email })
      setError(t('login.resend_success'))
      setDeactivated(false)
    } catch {
      setError(t('login.resend_error'))
    } finally { setResending(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setDeactivated(false)
    try {
      await login(email, password)
      setSuccess(true)
      setTimeout(() => navigate('/app/dashboard'), 1400)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.errors?.email?.[0] === 'deactivated') {
        setDeactivated(true)
      } else {
        setError(t('login.error_credentials'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) return <NoctuaLoader visible={true} />

  return (
    <div
      className="relative min-h-screen bg-[color:var(--color-noctua-bg)] overflow-hidden"
      style={pageStyle}
    >
      <AuroraBackground />

      {/* ── Floating back button ── */}
      <button
        onClick={() => navTo('/', 'back')}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full text-gray-400 hover:text-white text-xs font-semibold group transition-all duration-200 hover:bg-white/8"
        style={{
          background:     'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(12px)',
          border:         '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
        {t('login.back_home')}
      </button>

      {/* ── Centered card ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-3xl border border-white/10 p-10 flex flex-col gap-7"
          style={{
            background:           'rgba(255,255,255,0.05)',
            backdropFilter:       'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            boxShadow:            '0 32px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* ── Branding único ── */}
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight leading-none">
              n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
            </h1>
            <p className="text-sm text-gray-500 font-light mt-1">{t('login.tagline')}</p>
            <div className="w-8 h-px bg-[color:var(--color-noctua-amber)] mt-3 rounded-full opacity-50" />
          </div>

          {/* ── Deactivated warning ── */}
          {deactivated && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-xl px-4 py-4 flex flex-col gap-3">
              <p className="font-semibold">{t('login.account_deactivated')}</p>
              <p className="text-xs text-amber-300/70">{t('login.reactivation_hint')}</p>
              <button
                onClick={handleResendReactivation}
                disabled={resending}
                className="w-full py-2 rounded-lg text-xs font-bold text-black bg-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {resending ? t('login.resending') : t('login.resend_activation')}
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('login.email')}
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="tu@equipo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors duration-200 pr-10"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors duration-200 pr-10"
                  required
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => navTo('/forgot-password', 'forward')}
                className="text-xs text-[color:var(--color-noctua-amber)] hover:underline text-left mt-0.5 w-fit"
              >
                {t('login.forgot_password')}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] text-black font-bold text-sm transition-colors duration-200 glow-amber disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          {/* ── Single register CTA ── */}
          <p className="text-sm text-gray-600 text-center">
            {t('login.no_account')}{' '}
            <button
              onClick={() => navTo('/register', 'forward')}
              className="text-[color:var(--color-noctua-amber)] font-semibold hover:underline transition-colors"
            >
              {t('login.register_link')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
