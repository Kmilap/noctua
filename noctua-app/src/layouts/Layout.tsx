import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import AuroraBackground from '../components/AuroraBackground'

const allNavItems = [
  { label: 'Dashboard',        path: '/dashboard',   page: 'dashboard'   },
  { label: 'Servicios',        path: '/services',    page: 'services'    },
  { label: 'Reglas de alerta', path: '/alert-rules', page: 'alert-rules' },
  { label: 'Incidentes',       path: '/incidents',   page: 'incidents'   },
  { label: 'Canales',          path: '/channels',    page: 'channels'    },
  { label: 'Equipo',           path: '/team',        page: 'team'        },
]

export default function Layout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user }   = useAuth()
  const { can }    = usePermissions()

  const navItems = allNavItems.filter(item => can(item.page))

  const handleLogout = async () => {
    const token = localStorage.getItem('token')
    await axios.post('http://localhost:8000/api/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // Iniciales del usuario para el avatar
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const rolLabel = user?.role === 'admin' ? 'Admin'
    : user?.role === 'operator' ? 'Operator'
    : 'Viewer'

  return (
    <div className="relative flex h-screen bg-[color:var(--color-noctua-bg)] text-white">
      <AuroraBackground />

      {/* Sidebar */}
      <aside
        className="relative z-10 w-60 shrink-0 flex flex-col justify-between py-6 px-4 border-r border-white/5"
        style={{
          background: 'rgba(15, 14, 23, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        {/* Top: logo + nav */}
        <div>
          <div className="mb-8 px-2">
            <span className="text-2xl font-bold tracking-tight">
              noct<span className="text-[color:var(--color-noctua-amber)]">u</span>a
            </span>
            <p className="text-xs text-gray-500 mt-1">Vigila mientras dormís.</p>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom: avatar + logout */}
        <div className="flex flex-col gap-3">
          {/* Avatar del usuario */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/5">
            <div className="
              w-8 h-8 rounded-full shrink-0
              bg-[color:var(--color-noctua-amber)]/20
              border border-[color:var(--color-noctua-amber)]/30
              flex items-center justify-center
              text-xs font-bold text-[color:var(--color-noctua-amber)]
            ">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-gray-500">{rolLabel}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-red-900/30 transition-colors duration-200 text-left"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}