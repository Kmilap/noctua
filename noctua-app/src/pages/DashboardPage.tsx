import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { formatRelativeTime } from '../utils/formatRelativeTime'

type DashboardStats = {
  active_services: number
  total_services: number
  open_incidents: number
  critical_incidents: number
  warning_incidents: number
  avg_response_time: number
  alerts_today: number
  resolved_today: number
  active_alerts: number
}

type ServiceRow = {
  id: number
  name: string
  url: string | null
  status: 'active' | 'warning' | 'critical' | 'unknown'
  response_time_ms: number | null
  uptime_24h: number | null
  last_seen_at: string | null
}

const statusConfig = {
  active:   { label: 'Activo',       dot: 'bg-emerald-400', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' },
  warning:  { label: 'Warning',      dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20' },
  critical: { label: 'Caído',        dot: 'bg-red-400',     badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
  unknown:  { label: 'Desconocido',  dot: 'bg-gray-500',    badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

export default function DashboardPage() {
  const { token } = useAuth()
  const headers = { Authorization: `Bearer ${token}` }

  const [stats, setStats]       = useState<DashboardStats | null>(null)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
  const fetchAll = async () => {
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/services', { headers }),
        axios.get('http://localhost:8000/api/incidents', { headers }),
      ])

      const svcs = servicesRes.data ?? []
      const incidents = incidentsRes.data?.data ?? []

      // Calculamos stats en el frontend con lo que tenemos
      const activeServices = svcs.filter((s: any) => s.status === 'active').length
      const openIncidents  = incidents.filter((i: any) => i.status !== 'resolved').length
      const criticalInc    = incidents.filter((i: any) => i.alert_rule?.severity === 'critical' && i.status !== 'resolved').length
      const warningInc     = incidents.filter((i: any) => i.alert_rule?.severity === 'warning' && i.status !== 'resolved').length
      const resolvedToday  = incidents.filter((i: any) => {
        if (!i.resolved_at) return false
        return new Date(i.resolved_at).toDateString() === new Date().toDateString()
      }).length

      // Promedio de response_time de los servicios que tienen dato
      const responseTimes = svcs.map((s: any) => s.last_response_time_ms).filter(Boolean)
      const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
        : 0

      setStats({
        active_services:    activeServices,
        total_services:     svcs.length,
        open_incidents:     openIncidents,
        critical_incidents: criticalInc,
        warning_incidents:  warningInc,
        avg_response_time:  avgResponse,
        alerts_today:       incidents.length,
        resolved_today:     resolvedToday,
        active_alerts:      openIncidents,
      })

      // Mapeamos servicios al formato que espera la tabla
      setServices(svcs.map((s: any) => ({
        id:               s.id,
        name:             s.name,
        url:              s.url ?? null,
        status:           s.status ?? 'unknown',
        response_time_ms: s.last_response_time_ms ?? null,
        uptime_24h:       s.uptime_24h != null ? parseFloat(s.uptime_24h).toFixed(2) : null,
        last_seen_at:     s.last_seen_at ?? null,
      })))

    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const metricCards = stats ? [
    {
      label: 'Servicios activos',
      value: stats.active_services,
      sub: `de ${stats.total_services} registrados`,
    },
    {
      label: 'Incidentes abiertos',
      value: stats.open_incidents,
      sub: stats.open_incidents > 0
        ? `${stats.critical_incidents} critical, ${stats.warning_incidents} warning`
        : 'Sin incidentes activos',
    },
    {
      label: 'Tiempo promedio',
      value: stats.avg_response_time > 0 ? `${stats.avg_response_time}ms` : '—',
      sub: 'respuesta p50 hoy',
    },
    {
      label: 'Alertas hoy',
      value: stats.alerts_today,
      sub: `${stats.resolved_today} resueltas, ${stats.active_alerts} activas`,
    },
  ] : []

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Estado general de tus servicios</p>
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {metricCards.map((card, i) => (
            <div
              key={i}
              className="
                rounded-2xl px-5 py-5
                border border-white/8
                flex flex-col justify-between gap-3
              "
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <p className="text-sm text-gray-400">{card.label}</p>
              <p className="text-4xl font-bold text-white tracking-tight">{card.value}</p>
              <p className="text-xs text-gray-500">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Services table */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Servicios monitoreados</h2>
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
        >
          {/* Table header */}
          <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5">
            {['Servicio', 'Estado', 'Response Time', 'Uptime 24h', 'Última señal'].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Cargando...</div>
          ) : services.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">No hay servicios registrados.</div>
          ) : (
            services.map((svc, i) => {
              const cfg = statusConfig[svc.status] ?? statusConfig.unknown
              return (
                <div
                  key={svc.id}
                  className={`
                    grid grid-cols-5 px-6 py-4 items-center
                    transition-colors duration-200 hover:bg-white/3
                    ${i < services.length - 1 ? 'border-b border-white/5' : ''}
                  `}
                >
                  {/* Servicio */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{svc.name}</p>
                      {svc.url && (
                        <p className="text-xs text-gray-500 truncate">{svc.url}</p>
                      )}
                    </div>
                  </div>

                  {/* Estado */}
                  <span className={`
                    inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border
                    ${cfg.badge}
                  `}>
                    {cfg.label}
                  </span>

                  {/* Response time */}
                  <span className="text-sm text-gray-300 tabular-nums">
                    {svc.response_time_ms != null ? `${svc.response_time_ms}ms` : '—'}
                  </span>

                  {/* Uptime */}
                  <span className="text-sm text-gray-300 tabular-nums">
                    {svc.uptime_24h != null ? `${svc.uptime_24h}%` : '—'}
                  </span>

                  {/* Última señal */}
                  <span className="text-sm text-gray-400">
                    {svc.last_seen_at ? formatRelativeTime(svc.last_seen_at) : '—'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}