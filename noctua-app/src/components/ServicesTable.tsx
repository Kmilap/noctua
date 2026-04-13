import { useEffect, useState } from 'react'

interface ServiceStatus {
  id: number
  name: string
  status: 'active' | 'warning' | 'critical' | 'unknown'
  response_time_ms: number
  uptime_24h: number | null
  last_seen_at: string | null
}

const statusConfig = {
  active:   { label: 'Activo',   classes: 'bg-green-100 text-green-700'  },
  warning:  { label: 'Warning',  classes: 'bg-yellow-100 text-yellow-700' },
  critical: { label: 'Crítico',  classes: 'bg-red-100 text-red-700'      },
  unknown:  { label: 'Unknown',  classes: 'bg-gray-100 text-gray-600'    },
}

export default function ServicesTable() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:8000/api/services/status', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        })
        const data = await res.json()
        setServices(data)
      } catch (err) {
        console.error('Error cargando servicios:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchServices()
    const interval = setInterval(fetchServices, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <p className="text-gray-500 mt-6">Cargando servicios...</p>

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Estado de servicios</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-3 text-left">Servicio</th>
              <th className="px-6 py-3 text-left">Estado</th>
              <th className="px-6 py-3 text-left">Tiempo de respuesta</th>
              <th className="px-6 py-3 text-left">Uptime 24h</th>
              <th className="px-6 py-3 text-left">Última vez visto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((service) => {
              const config = statusConfig[service.status] ?? statusConfig.unknown
              return (
                <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{service.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.classes}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{service.response_time_ms} ms</td>
                  <td className="px-6 py-4 text-gray-600">
                    {service.uptime_24h !== null ? `${service.uptime_24h}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {service.last_seen_at
                      ? new Date(service.last_seen_at).toLocaleString('es-CO')
                      : '—'}
                  </td>
                </tr>
              )
            })}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No hay servicios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}