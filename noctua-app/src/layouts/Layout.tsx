import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import AuroraBackground from '../components/AuroraBackground'
import NoctuaLoader from '../components/NoctuaLoader'

function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine)
  
  useEffect(() => {
    const off = () => setOffline(true)
    const on  = () => setOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online',  on)
    return () => { 
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on) 
    }
  }, [])

  return offline
}

export default function Layout() {
  const location  = useLocation()
  const { user }  = useAuth()
  const { can }   = usePermissions()
  const offline   = useOffline()
  const { t }     = useTranslation()

  const allNavItems = [
    { label: t('nav.dashboard'),   path: '/app/dashboard',   page: 'dashboard'   },
    { label: t('nav.services'),    path: '/app/services',    page: 'services'    },
    { label: t('nav.alert_rules'), path: '/app/alert-rules', page: 'alert-rules' },
    { label: t('nav.incidents'),   path: '/app/incidents',   page: 'incidents'   },
    { label: t('nav.channels'),    path: '/app/channels',    page: 'channels'    },
    { label: t('nav.team'),        path: '/app/team',        page: 'team'        },
    { label: t('nav.activity'),    path: '/app/activity',    page: 'activity'    },
    { label: t('nav.historial'),   path: '/app/historial',   page: 'historial'   },
  ]

  const navItems = allNavItems.filter(item => can(item.page))

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const rolLabel = user?.role === 'admin' ? 'Admin'
    : user?.role === 'operator' ? 'Operator'
    : 'Viewer'

  return (
    <div className="relative flex h-screen bg-[color:var(--color-noctua-bg)] text-white overflow-hidden">
      <AuroraBackground />
      <NoctuaLoader visible={offline} />

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-60 shrink-0 flex flex-col justify-between py-6 px-4 border-r border-white/5"
        style={{
          background: 'rgba(15, 14, 23, 0.72)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        {/* Logo */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-8 px-2"
          >
            <span className="text-2xl font-bold tracking-tight">
              n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
            </span>
            <p className="text-xs text-gray-500 mt-1">{t('nav.tagline')}</p>
          </motion.div>

          {/* Nav items */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item, i) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.04, duration: 0.3 }}
                >
                  <Link
                    to={item.path}
                    className={`
                      relative flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      transition-colors duration-200
                      ${isActive
                        ? 'text-[color:var(--color-noctua-amber)]'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-[color:var(--color-noctua-amber)]/15"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                </motion.div>
              )
            })}
          </nav>
        </div>

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          {/* Cambio 4: Link to actualizado a /app/profile */}
          <Link
            to="/app/profile"
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors duration-200 group"
          >
            <div className="
              w-9 h-9 rounded-full shrink-0
              bg-[color:var(--color-noctua-amber)]/20
              border-2 border-[color:var(--color-noctua-amber)]/40
              flex items-center justify-center
              text-xs font-bold text-[color:var(--color-noctua-amber)]
              group-hover:border-[color:var(--color-noctua-amber)]/70
              transition-colors duration-200
            ">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-[color:var(--color-noctua-amber)]">{rolLabel}</p>
            </div>
          </Link>
        </motion.div>
      </motion.aside>

      {/* Main con animación por ruta */}
      <main className="relative z-10 flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}