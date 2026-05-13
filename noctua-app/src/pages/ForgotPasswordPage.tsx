import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import AuroraBackground from '../components/AuroraBackground'

type Step = 1 | 2 | 3
type OtpStatus = 'idle' | 'success' | 'error'

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

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation()
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-400']
  const textColors = ['', 'text-red-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400']
  const labels = ['', t('register.strength_weak'), t('register.strength_fair'), t('register.strength_good'), t('register.strength_strong')]
  if (!password) return null
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-white/10'}`} />
        ))}
      </div>
      {score > 0 && <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>}
    </div>
  )
}

// Ícono animado según estado OTP
function OtpStatusIcon({ status }: { status: OtpStatus }) {
  if (status === 'idle') {
    return (
      <div className="w-16 h-16 rounded-full bg-white/8 border border-white/15 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div
        className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"
        style={{ animation: 'scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: 'draw-check 0.4s ease-out 0.1s both' }}>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
    )
  }

  // error
  return (
    <div
      className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center"
      style={{ animation: 'shake 0.4s ease-out' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </div>
  )
}

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {[1, 2, 3].map((n, i) => {
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
              transition-all duration-300
              ${done ? 'bg-emerald-500 text-white' : active ? 'bg-[color:var(--color-noctua-amber)] text-black' : 'bg-white/10 text-gray-500'}
            `}>
              {done ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : String(n).padStart(2, '0')}
            </div>
            {i < 2 && (
              <div className={`w-12 h-0.5 transition-all duration-300 ${n < current ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [step, setStep]         = useState<Step>(1)
  const [email, setEmail]       = useState('')
  const [otp, setOtp]           = useState('')           // código real generado
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']) // 6 cajas
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [countdown, setCountdown] = useState(59)
  const [canResend, setCanResend] = useState(false)

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const features = [
    { icon: '🟡', text: t('forgot_password.feature_monitoring') },
    { icon: '⚡', text: t('forgot_password.feature_alerts') },
    { icon: '🟡', text: t('forgot_password.feature_setup') },
  ]

  const stepLabels: Record<Step, string> = {
    1: t('forgot_password.step1_label'),
    2: t('forgot_password.step2_label'),
    3: t('forgot_password.step3_label'),
  }

  // Countdown para reenviar
  useEffect(() => {
    if (step !== 2) return
    setCountdown(59)
    setCanResend(false)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setCanResend(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await axios.post('http://localhost:8000/api/forgot-password', { email })
      setOtpInput(['', '', '', '', '', ''])
      setOtpStatus('idle')
      setStep(2)
    } catch {
      setError(t('forgot_password.step1_error'))
    } finally {
      setLoading(false)
    }
  }

  // Manejo de las 6 cajas OTP
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // solo números
    const next = [...otpInput]
    next[index] = value.slice(-1) // máximo 1 dígito
    setOtpInput(next)
    setOtpStatus('idle')

    // Avanzar al siguiente input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Verificar automáticamente cuando se completan los 6
    const full = next.join('')
    if (full.length === 6) {
      setTimeout(() => verifyOtp(full), 150)
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return
    const next = [...otpInput]
    pasted.split('').forEach((char, i) => { next[i] = char })
    setOtpInput(next)
    if (pasted.length === 6) {
      inputRefs.current[5]?.focus()
      setTimeout(() => verifyOtp(pasted), 150)
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  const verifyOtp = async (code: string) => {
    try {
      const res = await axios.post('http://localhost:8000/api/verify-otp', { email, otp: code })
      setOtp(res.data.reset_token)
      setOtpStatus('success')
      setTimeout(() => setStep(3), 900)
    } catch {
      setOtpStatus('error')
      setTimeout(() => {
        setOtpInput(['', '', '', '', '', ''])
        setOtpStatus('idle')
        inputRefs.current[0]?.focus()
      }, 1200)
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    try {
      await axios.post('http://localhost:8000/api/forgot-password', { email })
    } catch { /* silencioso */ }
    setOtpInput(['', '', '', '', '', ''])
    setOtpStatus('idle')
    setStep(2)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError(t('forgot_password.step3_error_match')); return }
    if (password.length < 8)  { setError(t('forgot_password.step3_error_length')); return }
    setLoading(true)
    setError('')
    try {
      await axios.post('http://localhost:8000/api/reset-password', {
        email,
        reset_token: otp,
        password,
        password_confirmation: confirm,
      })
      window.location.href = '/login'
    } catch {
      setError(t('forgot_password.step3_error_reset'))
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

  return (
    <>
      {/* Animaciones globales para este componente */}
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        @keyframes draw-check {
          from { stroke-dasharray: 30; stroke-dashoffset: 30; }
          to   { stroke-dasharray: 30; stroke-dashoffset: 0; }
        }
        .otp-input {
          -webkit-text-security: disc;
        }
      `}</style>

      <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex overflow-hidden">
        <AuroraBackground />

        {/* Izquierda */}
        <div
          className="relative z-10 flex-1 flex flex-col justify-between p-12 lg:p-16 border-r border-white/8"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-white">
              n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
            </h1>
            <p className="text-gray-400 mt-3 text-lg">{t('forgot_password.tagline')}</p>
            <div className="w-10 h-0.5 bg-[color:var(--color-noctua-amber)] mt-3 rounded-full" />
          </div>

          <div className="flex flex-col gap-4">
            <Stepper current={step} />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{t('forgot_password.step_label')} {step} {t('forgot_password.step_of')}</p>
              <p className="text-sm text-gray-300 mt-1">— {stepLabels[step]}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {features.map((f, i) => (
              <div key={i} className="inline-flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-5 py-3 w-full max-w-xs backdrop-blur-sm">
                <span className="text-base">{f.icon}</span>
                <span className="text-sm font-medium text-gray-300">{f.text}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600">{t('forgot_password.footer')}</p>
        </div>

        {/* Derecha */}
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
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}
          >

            {/* ── Paso 1 ── */}
            {step === 1 && (
              <>
                <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mb-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{t('forgot_password.step1_title')}</h2>
                <p className="text-sm text-gray-400 mt-1 mb-6">{t('forgot_password.step1_subtitle')}</p>

                <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{t('forgot_password.step1_email')}</label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="tu@equipo.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={inputClass + ' pr-8'}
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--color-noctua-amber)]" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] text-black font-bold text-sm transition-colors duration-200 glow-amber disabled:opacity-50 mt-2"
                  >
                    {loading ? t('forgot_password.step1_sending') : t('forgot_password.step1_submit')}
                  </button>
                </form>
                <Link to="/login" className="block text-center text-sm text-gray-500 hover:text-gray-300 transition-colors mt-5">
                   {t('forgot_password.step1_back')}
                </Link>
              </>
            )}

            {/* ── Paso 2: OTP ── */}
            {step === 2 && (
              <div className="flex flex-col items-center gap-5">

                {/* Ícono animado */}
                <OtpStatusIcon status={otpStatus} />

                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {otpStatus === 'error' ? t('forgot_password.step2_title_error') : t('forgot_password.step2_title')}
                  </h2>
                  <p className="text-sm text-gray-400 mt-2">
                    {otpStatus === 'error'
                      ? t('forgot_password.step2_subtitle_error')
                      : t('forgot_password.step2_subtitle')}
                  </p>
                  {otpStatus !== 'error' && (
                    <p className="text-sm font-semibold text-[color:var(--color-noctua-amber)] mt-1">{email}</p>
                  )}
                </div>

                {/* Cajas OTP */}
                <div className="flex gap-2 w-full justify-center" onPaste={handleOtpPaste}>
                  {otpInput.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`
                        w-11 h-14 text-center text-xl font-bold rounded-xl outline-none
                        border-2 transition-all duration-200
                        bg-white/5 text-white
                        ${otpStatus === 'success'
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : otpStatus === 'error'
                            ? 'border-red-500 bg-red-500/10'
                            : digit
                              ? 'border-[color:var(--color-noctua-amber)] bg-[color:var(--color-noctua-amber)]/5'
                              : 'border-white/15 focus:border-[color:var(--color-noctua-amber)]/60'
                        }
                      `}
                      disabled={otpStatus === 'success'}
                    />
                  ))}
                </div>

                {/* Hint de desarrollo */}
                <p className="text-xs text-gray-600 text-center">
                  {t('forgot_password.step2_dev_hint')}
                </p>

                {/* Reenviar */}
                <div className="flex items-center gap-3 w-full justify-center">
                  <p className="text-sm text-gray-500">{t('forgot_password.step2_not_arrived')}</p>
                  <button
                    onClick={handleResend}
                    disabled={!canResend}
                    className={`text-sm font-semibold transition-colors ${canResend ? 'text-[color:var(--color-noctua-amber)] hover:underline' : 'text-gray-600 cursor-not-allowed'}`}
                  >
                    {t('forgot_password.step2_resend')}
                  </button>
                  {!canResend && (
                    <span className="ml-auto text-xs text-gray-500 bg-white/5 border border-white/10 px-3 py-1 rounded-lg">
                      {t('forgot_password.step2_countdown', { count: countdown })}
                    </span>
                  )}
                </div>

                <Link to="/login" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                   {t('forgot_password.step2_back')}
                </Link>
              </div>
            )}

            {/* ── Paso 3 ── */}
            {step === 3 && (
              <>
                <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mb-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{t('forgot_password.step3_title')}</h2>
                <p className="text-sm text-gray-400 mt-1 mb-6">{t('forgot_password.step3_subtitle')}</p>

                {error && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
                )}

                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{t('forgot_password.step3_new_pass')}</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder={t('forgot_password.step3_min_chars')}
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
                    <PasswordStrength password={password} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{t('forgot_password.step3_confirm')}</label>
                    <div className="relative">
                      <input
                        type={showConf ? 'text' : 'password'}
                        placeholder={t('forgot_password.step3_repeat')}
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl mt-1 bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] text-black font-bold text-sm transition-colors duration-200 glow-amber disabled:opacity-50"
                  >
                    {loading ? t('forgot_password.step3_saving') : t('forgot_password.step3_submit')}
                  </button>
                </form>

                <p className="text-xs text-gray-500 text-center mt-4">
                  {t('forgot_password.step3_session_note')}
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  )
}