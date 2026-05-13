import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import AuroraBackground from '../components/AuroraBackground'
import NoctuaLoader from '../components/NoctuaLoader'

export default function ReactivatePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const { t } = useTranslation()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token || !email) {
      setStatus('error')
      setMessage(t('reactivate.invalid_link'))
      return
    }

    axios.post('http://localhost:8000/api/account/reactivate', { token, email })
      .then(() => {
        setStatus('success')
        setMessage(t('reactivate.success_msg'))
      })
      .catch(err => {
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message : ''
        if (msg.includes('invalido') || msg.includes('expirado')) {
          setStatus('success')
          setMessage(t('reactivate.already_active'))
        } else {
          setStatus('error')
          setMessage(msg || t('reactivate.expired_link'))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email])

  if (status === 'loading') return <NoctuaLoader visible={true} />

  return (
    <div className="relative min-h-screen bg-[color:var(--color-noctua-bg)] flex items-center justify-center overflow-hidden">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md p-8">
        <div className="rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-6 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}>

          {/* Logo */}
          <p className="text-2xl font-bold text-white">
            n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
          </p>

          {/* Ícono */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
            status === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40'
              : 'bg-red-500/20 border-red-500/40'
          }`}
            style={{ animation: 'scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {status === 'success' ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">
              {status === 'success' ? t('reactivate.success_title') : t('reactivate.error_title')}
            </h2>
            <p className="text-sm text-gray-400 mt-2">{message}</p>
          </div>

          <Link to="/login"
            className="w-full py-3.5 rounded-xl text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 text-center">
            {status === 'success' ? t('reactivate.go_to_login') : t('reactivate.back_to_login')}
          </Link>
        </div>
      </div>
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
