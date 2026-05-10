import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useNavigate } from 'react-router-dom'
import { formatRelativeTime } from '../utils/formatRelativeTime'

type Incident = {
  id: number
  status: string
  triggered_at: string
  resolved_at: string | null
  alert_rule?: {
    name?: string
    metric_name?: string
    operator?: string
    threshold?: number
    severity: string
    service?: { id: number; name: string }
  }
}

type MetricPoint = { timestamp: string; value: number; metric_name: string }

const severityColor: Record<string, string> = {
  critical: 'bg-red-400/15 text-red-400 border-red-400/20',
  warning:  'bg-amber-400/15 text-amber-400 border-amber-400/20',
  info:     'bg-blue-400/15 text-blue-400 border-blue-400/20',
}

const statusColor: Record<string, string> = {
  open:         'bg-red-400/15 text-red-400 border-red-400/20',
  acknowledged: 'bg-amber-400/15 text-amber-400 border-amber-400/20',
  resolved:     'bg-emerald-400/15 text-emerald-400 border-emerald-400/20',
}

export default function ActivityPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const navigate  = useNavigate()
  const headers   = { Authorization: `Bearer ${token}` }

  const [incidents, setIncidents]     = useState<Incident[]>([])
  const [recentMetrics, setRecentMetrics] = useState<MetricPoint[]>([])
  const [services, setServices]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<'incidents' | 'metrics'>('incidents')

  // Solo operadores y admins
  useEffect(() => {
    if (role === 'viewer') { navigate('/dashboard'); return }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const fetchAll = async () => {
    try {
      const [incRes, svcRes] = await Promise.all([
        axios.get('http://localhost:8000/api/incidents', { headers, params: { per_page: 50, with: 'alertRule.service' } }),
        axios.get('http://localhost:8000/api/services', { headers }),
      ])
      setIncidents(incRes.data?.data ?? [])
      const svcs = svcRes.data ?? []
      setServices(svcs)

      // Traer métricas recientes de los primeros 3 servicios
      const metricResults = await Promise.allSettled(
        svcs.slice(0, 3).map((s: any) =>
          axios.get(`http://localhost:8000/api/services/${s.id}/metrics/history`, {
            headers, params: { metric: 'response_time', range: '1h' }
          }).then(r => (r.data?.points ?? []).map((p: any) => ({
            ...p, metric_name: s.name, service_id: s.id
          })))
        )
      )

      const allPoints: MetricPoint[] = []
      metricResults.forEach(r => {
        if (r.status === 'fulfilled') allPoints.push(...r.value)
      })
      allPoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentMetrics(allPoints.slice(0, 30))
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  const openIncidents   = incidents.filter(i => i.status !== 'resolved')
  const resolvedToday   = incidents.filter(i => {
    if (!i.resolved_at) return false
    return new Date(i.resolved_at).toDateString() === new Date().toDateString()
  })

  const tabClass = (t: string) => `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ` +
    (activeTab === t
      ? 'bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)]'
      : 'text-gray-400 hover:text-white hover:bg-white/5')

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Historial de actividad</h1>
        <p className="text-sm text-gray-400 mt-1">Vista técnica exclusiva para Operadores — incidentes y métricas en tiempo real.</p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Incidentes abiertos',   value: openIncidents.length,              dot: 'bg-red-400' },
          { label: 'Resueltos hoy',          value: resolvedToday.length,              dot: 'bg-emerald-400' },
          { label: 'Total incidentes',       value: incidents.length,                  dot: 'bg-gray-400' },
          { label: 'Servicios monitoreados', value: services.length,                   dot: 'bg-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl px-5 py-4 border border-white/8 flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-2">
              <span className={'w-2 h-2 rounded-full ' + stat.dot} />
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/8 pb-3">
        <button className={tabClass('incidents')} onClick={() => setActiveTab('incidents')}>
          Incidentes ({incidents.length})
        </button>
        <button className={tabClass('metrics')} onClick={() => setActiveTab('metrics')}>
          Métricas recientes ({recentMetrics.length})
        </button>
      </div>

      {/* Tab: Incidentes */}
      {activeTab === 'incidents' && (
        <div className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
          <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5">
            {['Servicio', 'Regla', 'Severidad', 'Estado', 'Inicio'].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>
          {loading ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">Cargando...</div>
          ) : incidents.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">Sin incidentes registrados.</div>
          ) : incidents.map((inc, i) => (
            <div key={inc.id}
              className={'grid grid-cols-5 px-6 py-4 items-center hover:bg-white/3 transition-colors ' + (i < incidents.length - 1 ? 'border-b border-white/5' : '')}>
              <span className="text-sm font-semibold text-white">{inc.alert_rule?.service?.name ?? '—'}</span>
              <span className="text-sm text-gray-300 truncate font-mono text-xs">
                {inc.alert_rule?.metric_name ? `${inc.alert_rule.metric_name} ${inc.alert_rule.operator} ${inc.alert_rule.threshold}` : '—'}
              </span>
              <span className={'inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ' + (severityColor[inc.alert_rule?.severity ?? ''] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20')}>
                {inc.alert_rule?.severity ?? '—'}
              </span>
              <span className={'inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ' + (statusColor[inc.status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20')}>
                {inc.status}
              </span>
              <span className="text-sm text-gray-400">{formatRelativeTime(inc.triggered_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Métricas */}
      {activeTab === 'metrics' && (
        <div className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
          <div className="grid grid-cols-4 px-6 py-3 border-b border-white/5">
            {['Servicio', 'Valor', 'Métrica', 'Hora'].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>
          {loading ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">Cargando...</div>
          ) : recentMetrics.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">Sin métricas recientes. Activa el simulador.</div>
          ) : recentMetrics.map((point, i) => (
            <div key={i}
              className={'grid grid-cols-4 px-6 py-3 items-center hover:bg-white/3 transition-colors ' + (i < recentMetrics.length - 1 ? 'border-b border-white/5' : '')}>
              <span className="text-sm font-semibold text-white">{point.metric_name}</span>
              <span className="text-sm font-bold text-[color:var(--color-noctua-amber)] tabular-nums">{Math.round(point.value)} ms</span>
              <span className="text-xs text-gray-500 font-mono">response_time</span>
              <span className="text-sm text-gray-400">{formatRelativeTime(point.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
