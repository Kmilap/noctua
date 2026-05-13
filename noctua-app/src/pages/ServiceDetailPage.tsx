import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import MetricsChart from '../components/MetricsChart'
import { ChevronLeft } from 'lucide-react'

type Signals = {
  latency: {
    response_time_avg_ms: number | null
    response_time_p95_ms: number | null
    response_time_p99_ms: number | null
  }
  traffic: { request_rate_per_min: number | null }
  errors: { error_rate_pct: number | null }
  saturation: { cpu_usage_pct: number | null; memory_usage_mb: number | null }
  availability: { last_status_code: number | null; uptime_24h_pct: number | null }
}

type Summary = {
  service_id: number
  service_name: string
  calculated_at: string
  window: string
  signals: Signals
}

type Incident = {
  id: number
  status: string
  triggered_at: string
  resolved_at: string | null
  alert_rule?: { metric_name: string; operator: string; threshold: string; severity: string }
}

const signalGroups = [
  {
    key: 'latency' as const,
    label: 'Latencia',
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    metrics: (s: Signals) => [
      { label: 'Response avg', value: s.latency.response_time_avg_ms !== null ? `${s.latency.response_time_avg_ms}ms` : '—' },
      { label: 'P95', value: s.latency.response_time_p95_ms !== null ? `${s.latency.response_time_p95_ms}ms` : '—' },
      { label: 'P99', value: s.latency.response_time_p99_ms !== null ? `${s.latency.response_time_p99_ms}ms` : '—' },
    ],
  },
  {
    key: 'traffic' as const,
    label: 'Tráfico',
    color: 'text-violet-400',
    dot: 'bg-violet-400',
    metrics: (s: Signals) => [
      { label: 'Request rate', value: s.traffic.request_rate_per_min !== null ? `${s.traffic.request_rate_per_min}/min` : '—' },
    ],
  },
  {
    key: 'errors' as const,
    label: 'Errores',
    color: 'text-red-400',
    dot: 'bg-red-400',
    metrics: (s: Signals) => [
      { label: 'Error rate', value: s.errors.error_rate_pct !== null ? `${s.errors.error_rate_pct}%` : '—' },
    ],
  },
  {
    key: 'saturation' as const,
    label: 'Saturación',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
    metrics: (s: Signals) => [
      { label: 'CPU', value: s.saturation.cpu_usage_pct !== null ? `${s.saturation.cpu_usage_pct}%` : '—' },
      { label: 'Memoria', value: s.saturation.memory_usage_mb !== null ? `${s.saturation.memory_usage_mb} MB` : '—' },
    ],
  },
  {
    key: 'availability' as const,
    label: 'Disponibilidad',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    metrics: (s: Signals) => [
      { label: 'Uptime 24h', value: s.availability.uptime_24h_pct !== null ? `${s.availability.uptime_24h_pct}%` : '—' },
      { label: 'Último status', value: s.availability.last_status_code !== null ? String(s.availability.last_status_code) : '—' },
    ],
  },
]

const severityBadge: Record<string, string> = {
  critical: 'bg-red-400/15 text-red-400 border-red-400/20',
  warning:  'bg-amber-400/15 text-amber-400 border-amber-400/20',
  info:     'bg-blue-400/15 text-blue-400 border-blue-400/20',
}

const incidentStatusBadge: Record<string, string> = {
  open:         'bg-red-400/15 text-red-400 border-red-400/20',
  acknowledged: 'bg-amber-400/15 text-amber-400 border-amber-400/20',
  resolved:     'bg-emerald-400/15 text-emerald-400 border-emerald-400/20',
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${token}` }

  const [summary, setSummary]     = useState<Summary | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchAll = async () => {
      try {
        const [summaryRes, incidentsRes] = await Promise.all([
          axios.get(`http://localhost:8000/api/services/${id}/metrics/summary`, { headers }),
          axios.get(`http://localhost:8000/api/incidents`, { headers, params: { service_id: id, per_page: 10 } }),
        ])
        setSummary(summaryRes.data)
        setIncidents(incidentsRes.data?.data ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="h-8 w-48 rounded-xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 mt-24">
        <p className="text-gray-400">No se encontró el servicio.</p>
        <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all duration-200"
            >
            <ChevronLeft size={24} />
        </button>
      </div>
    )
  }

  const signals = summary.signals

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all duration-200"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{summary.service_name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Calculado hace menos de {summary.window} · actualizado {formatRelativeTime(summary.calculated_at)}
          </p>
        </div>
      </div>

      {/* Four Golden Signals cards */}
      <div className="grid grid-cols-5 gap-4">
        {signalGroups.map(group => {
          const items = group.metrics(signals)
          return (
            <div
              key={group.key}
              className="rounded-2xl px-5 py-5 border border-white/8 flex flex-col gap-4"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                <p className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>
                  {group.label}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {items.map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Histórico de métricas</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricsChart serviceId={Number(id)} serviceName={summary.service_name} metric="response_time" range="24h" />
          <MetricsChart serviceId={Number(id)} serviceName={summary.service_name} metric="cpu_usage" range="24h" />
          <MetricsChart serviceId={Number(id)} serviceName={summary.service_name} metric="memory_usage" range="24h" />
        </div>
      </div>

      {/* Incidents table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-300">Incidentes recientes</h2>
          <Link to="/app/incidents" className="text-xs text-blue-400 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
        >
          <div className="grid grid-cols-4 px-6 py-3 border-b border-white/5">
            {['Regla', 'Severidad', 'Estado', 'Inicio'].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>
          {incidents.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Sin incidentes recientes.</div>
          ) : (
            incidents.map((inc, i) => (
              <div
                key={inc.id}
                className={`grid grid-cols-4 px-6 py-4 items-center ${i < incidents.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <span className="text-sm text-white">{inc.alert_rule ? `${inc.alert_rule.metric_name} ${inc.alert_rule.operator} ${inc.alert_rule.threshold}` : '—'}</span>
                <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ${severityBadge[inc.alert_rule?.severity ?? ''] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>
                  {inc.alert_rule?.severity ?? '—'}
                </span>
                <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ${incidentStatusBadge[inc.status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>
                  {inc.status}
                </span>
                <span className="text-sm text-gray-400">{formatRelativeTime(inc.triggered_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}