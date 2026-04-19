import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import IncidentFilters, { type IncidentFilter } from '../components/IncidentFilters'
import IncidentCard, { type AlertIncident } from '../components/IncidentCard'

export default function IncidentsPage() {
  const { token } = useAuth()
  const { role } = usePermissions()
  const headers = { Authorization: `Bearer ${token}` }

  // Solo admin y operator pueden reconocer/resolver. Viewer solo mira.
  const canActOnIncident = role === 'admin' || role === 'operator'

  // Estado: guardamos TODOS los incidentes en memoria.
  // Los contadores se calculan sobre esta lista completa.
  // La vista filtrada es derivada (useState no, se calcula on-the-fly).
  const [incidents, setIncidents] = useState<AlertIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<IncidentFilter>('all')

  // Fetch unico al montar. Trae todos los incidentes.
  // Pro: los contadores siempre son exactos.
  // Contra: si hay miles de incidentes, se carga todo. Aceptable para volumenes
  // tipicos (<500). Si crece mucho, refactorizar a endpoint de contadores separado.
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/incidents', { headers })
        setIncidents(res.data.data ?? [])
      } catch {
        setError('No se pudieron cargar los incidentes.')
      } finally {
        setLoading(false)
      }
    }
    fetchIncidents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lista visible: deriva del filtro activo. Cero fetches adicionales.
  const filteredIncidents = activeFilter === 'all'
    ? incidents
    : incidents.filter(i => i.status === activeFilter)

  // Contadores: siempre calculados desde la lista completa.
  const counts = {
    all: incidents.length,
    triggered:    incidents.filter(i => i.status === 'triggered').length,
    acknowledged: incidents.filter(i => i.status === 'acknowledged').length,
    resolved:     incidents.filter(i => i.status === 'resolved').length,
  }

  // Reconocer incidente (con optimistic update)
  const handleAcknowledge = async (incident: AlertIncident) => {
    const previous = incidents
    setIncidents(incidents.map(i =>
      i.id === incident.id ? { ...i, status: 'acknowledged' as const } : i
    ))

    try {
      const res = await axios.post(
        `http://localhost:8000/api/incidents/${incident.id}/acknowledge`,
        {},
        { headers }
      )
      // Reemplazar con la respuesta real (trae acknowledged_by y timestamps)
      setIncidents(prev => prev.map(i => i.id === incident.id ? res.data : i))
    } catch (err) {
      setIncidents(previous)
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : 'No se pudo reconocer el incidente.'
      setError(msg)
      setTimeout(() => setError(''), 4000)
    }
  }

  // Resolver incidente (con optimistic update)
  const handleResolve = async (incident: AlertIncident) => {
    const previous = incidents
    setIncidents(incidents.map(i =>
      i.id === incident.id ? { ...i, status: 'resolved' as const } : i
    ))

    try {
      const res = await axios.post(
        `http://localhost:8000/api/incidents/${incident.id}/resolve`,
        {},
        { headers }
      )
      setIncidents(prev => prev.map(i => i.id === incident.id ? res.data : i))
    } catch (err) {
      setIncidents(previous)
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : 'No se pudo resolver el incidente.'
      setError(msg)
      setTimeout(() => setError(''), 4000)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Incidentes
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitoreá alertas activas, reconocelas y resolvelas.
        </p>
      </div>

      {/* Error banner temporal */}
      {error && (
        <div className="bg-[color:var(--color-severity-critical-bg)] border border-[color:var(--color-severity-critical)]/30 text-[color:var(--color-severity-critical)] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Tabs de filtro con contadores */}
      <IncidentFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={counts}
      />

      {/* Estados: loading / empty / lista */}
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="
                bg-[color:var(--color-noctua-surface)]/30
                border border-[color:var(--color-noctua-border)]/30
                rounded-xl px-6 py-5
                animate-pulse
              "
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-5 w-40 bg-white/10 rounded mb-1" />
                  <div className="h-3 w-48 bg-white/5 rounded mb-3" />
                  <div className="h-3 w-64 bg-white/5 rounded" />
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="flex gap-2">
                    <div className="h-6 w-20 bg-white/10 rounded" />
                    <div className="h-6 w-16 bg-white/10 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-[color:var(--color-noctua-surface)]/40 border border-dashed border-[color:var(--color-noctua-border)]/60 rounded-xl px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            {activeFilter === 'all'
              ? 'No hay incidentes todavía. Cuando una regla se viole las veces consecutivas configuradas, aparecerán aquí.'
              : `No hay incidentes en estado "${activeFilter}".`
            }
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredIncidents.map((incident, index) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              canActOnIncident={canActOnIncident}
              animationDelay={index * 50}
            />
          ))}
        </div>
      )}
    </div>
  )
}