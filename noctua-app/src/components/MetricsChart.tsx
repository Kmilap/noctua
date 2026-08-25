import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

type MetricPoint = { timestamp: string; value: number }
type MetricsChartProps = {
  serviceId: number
  serviceName: string
  metric?: string
  range?: '1h' | '24h' | '7d'
}

const FALLBACK_CHAIN = ['response_time', 'cpu_usage', 'memory_usage']

export default function MetricsChart({
  serviceId,
  serviceName,
  metric = 'response_time',
  range = '24h',
}: MetricsChartProps) {
  const [points, setPoints]             = useState<MetricPoint[]>([])
  const [activeMetric, setActiveMetric] = useState(metric)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const fetchWithFallback = async () => {
      setLoading(true)
      const chain = [metric, ...FALLBACK_CHAIN.filter(m => m !== metric)]
      for (const m of chain) {
        try {
          const res = await api.get(
            `/services/${serviceId}/metrics/history`,
            { params: { metric: m, range } }
          )
          const pts: MetricPoint[] = res.data.points ?? []
          if (pts.length > 0) {
            setPoints(pts)
            setActiveMetric(m)
            setLoading(false)
            return
          }
        } catch {
          // continue fallback
        }
      }
      setPoints([])
      setActiveMetric(metric)
      setLoading(false)
    }
    fetchWithFallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, metric, range])

  const unit = activeMetric.includes('response_time') || activeMetric === 'memory_usage'
    ? 'ms'
    : activeMetric === 'cpu_usage' ? '%' : ''

  const labels = points.map(p => {
    const d = new Date(p.timestamp)
    return range === '7d'
      ? d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' })
      : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  })

  const data = {
    labels,
    datasets: [{
      label: `${activeMetric}${unit ? ` (${unit})` : ''}`,
      data: points.map(p => p.value),
      borderColor: 'rgba(239, 159, 39, 0.9)',
      backgroundColor: 'rgba(239, 159, 39, 0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: 'rgba(239, 159, 39, 1)',
      tension: 0.4,
      fill: true,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 14, 23, 0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#9ca3af',
        callbacks: { label: (ctx: any) => ` ${Math.round(ctx.parsed.y)}${unit}` },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6b7280', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6b7280', font: { size: 11 }, callback: (v: any) => `${v}${unit}` },
      },
    },
  }

  return (
    <div
      className="rounded-2xl border border-white/8 p-5 flex flex-col gap-4"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{serviceName}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{activeMetric}</p>
        </div>
        <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-lg border border-white/8">
          {range}
        </span>
      </div>
      <div className="h-48">
        {loading ? (
          <div className="h-full rounded-xl bg-white/5 animate-pulse" />
        ) : points.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-sm">Sin datos para este período.</p>
          </div>
        ) : (
          <Line data={data} options={options as any} />
        )}
      </div>
    </div>
  )
}
