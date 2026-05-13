import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import MetricsChart from '../components/MetricsChart'

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

type MetricSignals = {
  saturation: { cpu_usage_pct: number | null; memory_usage_mb: number | null }
  traffic: { request_rate_per_min: number | null }
  errors: { error_rate_pct: number | null }
}

const statusConfig = {
  active:   { label: 'Activo',       dot: 'bg-emerald-400', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' },
  warning:  { label: 'Warning',      dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400 border-amber-400/20' },
  critical: { label: 'Caído',        dot: 'bg-red-400',     badge: 'bg-red-400/15 text-red-400 border-red-400/20' },
  unknown:  { label: 'Desconocido',  dot: 'bg-gray-500',    badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

export default function DashboardPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${token}` }

  const [stats, setStats]             = useState<DashboardStats | null>(null)
  const [services, setServices]       = useState<ServiceRow[]>([])
  const [metricsMap, setMetricsMap]   = useState<Record<number, MetricSignals>>({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [servicesRes, incidentsRes] = await Promise.all([
          axios.get('http://localhost:8000/api/services/status', { headers }),
          axios.get('http://localhost:8000/api/incidents', { headers }),
        ])

        const svcs = servicesRes.data ?? []
        const incidents = incidentsRes.data?.data ?? []

        const activeServices = svcs.filter((s: any) => s.status === 'active').length
        const openIncidents  = incidents.filter((i: any) => i.status !== 'resolved').length
        const criticalInc    = incidents.filter((i: any) => i.alert_rule?.severity === 'critical' && i.status !== 'resolved').length
        const warningInc     = incidents.filter((i: any) => i.alert_rule?.severity === 'warning' && i.status !== 'resolved').length
        const resolvedToday  = incidents.filter((i: any) => {
          if (!i.resolved_at) return false
          return new Date(i.resolved_at).toDateString() === new Date().toDateString()
        }).length

        const responseTimes = svcs.map((s: any) => s.response_time_ms).filter(Boolean)
        const avgResponse = responseTimes.length
          ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
          : 0

        setStats({
          active_services: activeServices, total_services: svcs.length,
          open_incidents: openIncidents, critical_incidents: criticalInc,
          warning_incidents: warningInc, avg_response_time: avgResponse,
          alerts_today: incidents.length, resolved_today: resolvedToday,
          active_alerts: openIncidents,
        })

        const mapped: ServiceRow[] = svcs.map((s: any) => ({
          id: s.id, name: s.name, url: s.url, status: s.status,
          response_time_ms: s.response_time_ms ?? null,
          uptime_24h: s.uptime_24h ?? null,
          last_seen_at: s.last_seen_at ?? null,
        }))
        setServices(mapped)

        // Fetch metrics/summary para cada servicio en paralelo
        const summaryResults = await Promise.allSettled(
          svcs.map((s: any) =>
            axios.get(`http://localhost:8000/api/services/${s.id}/metrics/summary`, { headers })
          )
        )

        const newMap: Record<number, MetricSignals> = {}
        summaryResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const signals = result.value.data?.signals
            if (signals) newMap[svcs[idx].id] = signals
          }
        })
        setMetricsMap(newMap)

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calcular promedios agregados de todos los servicios
  const avgCpu = (() => {
    const vals = Object.values(metricsMap).map(m => m.saturation.cpu_usage_pct).filter((v): v is number => v !== null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })()

  const avgMem = (() => {
    const vals = Object.values(metricsMap).map(m => m.saturation.memory_usage_mb).filter((v): v is number => v !== null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })()

  const totalRequestRate = (() => {
    const vals = Object.values(metricsMap).map(m => m.traffic.request_rate_per_min).filter((v): v is number => v !== null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0)) : null
  })()

  const avgErrorRate = (() => {
    const vals = Object.values(metricsMap).map(m => m.errors.error_rate_pct).filter((v): v is number => v !== null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null
  })()

  const metricCards = stats ? [
    {
      label: 'Servicios activos',
      value: `${stats.active_services}/${stats.total_services}`,
      sub: 'servicios monitoreados',
    },
    {
      label: 'Incidentes abiertos',
      value: stats.open_incidents,
      sub: stats.open_incidents > 0
        ? `${stats.critical_incidents} critical, ${stats.warning_incidents} warning`
        : 'Sin incidentes activos',
    },
    {
      label: 'Response time avg',
      value: stats.avg_response_time > 0 ? `${stats.avg_response_time}ms` : '—',
      sub: 'respuesta p50 hoy',
    },
    {
      label: 'Alertas hoy',
      value: stats.alerts_today,
      sub: `${stats.resolved_today} resueltas, ${stats.active_alerts} activas`,
    },
    {
      label: 'CPU promedio',
      value: avgCpu !== null ? `${avgCpu}%` : '—',
      sub: 'todos los servicios',
    },
    {
      label: 'Memoria promedio',
      value: avgMem !== null ? `${avgMem} MB` : '—',
      sub: 'todos los servicios',
    },
    {
      label: 'Request rate',
      value: totalRequestRate !== null ? `${totalRequestRate}/min` : '—',
      sub: 'peticiones totales',
    },
    {
      label: 'Error rate',
      value: avgErrorRate !== null ? `${avgErrorRate}%` : '—',
      sub: 'promedio servicios',
    },
  ] : []

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Estado general de tus servicios</p>
      </div>

      {/* 8 Metric cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {metricCards.map((card, i) => (
            <div
              key={i}
              className="rounded-2xl px-5 py-5 border border-white/8 flex flex-col justify-between gap-3"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
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
          <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5">
            {['Servicio', 'Estado', 'Response Time', 'Uptime 24h', 'Última señal'].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>

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
                  onClick={() => navigate(`/app/services/${svc.id}`)}
                  className={`
                    grid grid-cols-5 px-6 py-4 items-center cursor-pointer
                    transition-colors duration-200 hover:bg-white/5
                    ${i < services.length - 1 ? 'border-b border-white/5' : ''}
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{svc.name}</p>
                      {svc.url && <p className="text-xs text-gray-500 truncate">{svc.url}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm text-gray-300 tabular-nums">
                    {svc.response_time_ms != null ? `${svc.response_time_ms}ms` : '—'}
                  </span>
                  <span className="text-sm text-gray-300 tabular-nums">
                    {svc.uptime_24h != null ? `${svc.uptime_24h}%` : '—'}
                  </span>
                  <span className="text-sm text-gray-400">
                    {svc.last_seen_at ? formatRelativeTime(svc.last_seen_at) : '—'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Gráfico de métricas */}
      {services.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Métricas históricas</h2>
          <div className="grid grid-cols-2 gap-4">
            {services.filter(s => s.status !== 'unknown').map(svc => (
              <MetricsChart
                key={svc.id}
                serviceId={svc.id}
                serviceName={svc.name}
                metric="response_time"
                range="24h"
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}