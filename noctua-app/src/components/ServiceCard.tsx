type Service = {
  id: number
  name: string
  url: string | null
  status: 'active' | 'warning' | 'critical' | 'unknown'
  last_seen_at: string | null
}

const statusConfig = {
  active:   { label: 'Activo',      color: 'bg-green-500' },
  warning:  { label: 'Advertencia', color: 'bg-yellow-500' },
  critical: { label: 'Crítico',     color: 'bg-red-500' },
  unknown:  { label: 'Desconocido', color: 'bg-gray-500' },
}

export default function ServiceCard({ service }: { service: Service }) {
  const status = statusConfig[service.status] ?? statusConfig.unknown

  return (
    <div className="bg-[#1A1A2E] border border-[#26215C] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">{service.name}</h3>
        <span className={`${status.color} text-black text-xs font-bold px-2 py-1 rounded-full`}>
          {status.label}
        </span>
      </div>

      {service.url && (
        <p className="text-gray-400 text-sm truncate">{service.url}</p>
      )}

      <p className="text-gray-600 text-xs">
        {service.last_seen_at
          ? `Última señal: ${new Date(service.last_seen_at).toLocaleString('es-CO')}`
          : 'Sin señal todavía'}
      </p>
    </div>
  )
}