import { Link, Outlet, useNavigate } from 'react-router-dom'
import axios from 'axios'

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Servicios', path: '/services' },
  { label: 'Reglas de alerta', path: '/alert-rules' },
  { label: 'Incidentes', path: '/incidents' },
  { label: 'Canales', path: '/channels' },
  { label: 'Equipo', path: '/team' },
]

export default function Layout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    const token = localStorage.getItem('token')
    await axios.post('http://localhost:8000/api/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#0F0E17] text-white">
      <aside className="w-60 bg-[#1A1A2E] flex flex-col justify-between py-6 px-4">
        <div>
          <div className="mb-8 px-2">
            <span className="text-2xl font-bold tracking-tight">
              noct<span className="text-[#EF9F27]">u</span>a
            </span>
            <p className="text-xs text-gray-500 mt-1">Vigila mientras dormís.</p>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#26215C] hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-red-900 transition-colors text-left"
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}