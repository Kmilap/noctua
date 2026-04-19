import { Link, Outlet, useNavigate } from 'react-router-dom'
import axios from 'axios'
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
  const navigate = useNavigate()
  const { can } = usePermissions()

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

  return (
    <div className="relative flex h-screen bg-[color:var(--color-noctua-bg)] text-white">      {/* Aurora de fondo — detras de todo, no interactivo */}
      <AuroraBackground />

      {/* Sidebar con efecto cristal opaco */}
      <aside
        className="
          relative z-10
          w-60 shrink-0
          flex flex-col justify-between
          py-6 px-4
          border-r border-white/5
        "
        style={{
          background: 'rgba(15, 14, 23, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div>
          <div className="mb-8 px-2">
            <span className="text-2xl font-bold tracking-tight">
              noct<span className="text-[color:var(--color-noctua-amber)]">u</span>a
            </span>
            <p className="text-xs text-gray-500 mt-1">Vigila mientras dormís.</p>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="
                  px-3 py-2 rounded-lg text-sm text-gray-300
                  hover:bg-white/5 hover:text-white
                  transition-colors duration-200
                "
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="
            px-3 py-2 rounded-lg text-sm
            text-gray-400 hover:text-white hover:bg-red-900/30
            transition-colors duration-200 text-left
          "
        >
          Cerrar sesión
        </button>
      </aside>

      {/* Main content — sobre el aurora, pero sin backdrop porque ya ve el fondo directo */}
      <main className="relative z-10 flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}