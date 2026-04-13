import { useEffect, useState } from 'react'
import axios from 'axios'
import ServiceCard from '../components/ServiceCard'
import { useAuth } from '../hooks/useAuth'

type Service = {
  id: number
  name: string
  url: string | null
  status: 'active' | 'warning' | 'critical' | 'unknown'
  last_seen_at: string | null
}

export default function ServicesPage() {
  const { token } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [creating, setCreating] = useState(false)

  const headers = { Authorization: `Bearer ${token}` }

  const fetchServices = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/services', { headers })
      setServices(res.data)
    } catch {
      setError('No se pudieron cargar los servicios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await axios.post('http://localhost:8000/api/services', { name, url }, { headers })
      setNewApiKey(res.data.api_key)
      setName('')
      setUrl('')
      fetchServices()
    } catch {
      setError('Error al crear el servicio.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Servicios</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#EF9F27] text-black font-semibold px-4 py-2 rounded-lg hover:bg-[#d4891f] transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nuevo servicio'}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1A1A2E] border border-[#26215C] rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Nuevo servicio</h2>
          <input
            type="text"
            placeholder="Nombre del servicio"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <input
            type="text"
            placeholder="URL (opcional)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !name}
            className="bg-[#EF9F27] text-black font-semibold rounded-lg py-3 hover:bg-[#d4891f] transition-colors disabled:opacity-50"
          >
            {creating ? 'Creando...' : 'Crear servicio'}
          </button>
        </div>
      )}

      {newApiKey && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
          <p className="text-green-400 text-sm font-semibold mb-2">
            ⚠️ Guardá esta API key, no se mostrará de nuevo:
          </p>
          <code className="text-green-300 text-xs break-all">{newApiKey}</code>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando servicios...</p>
      ) : services.length === 0 ? (
        <p className="text-gray-500">No hay servicios registrados todavía.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  )
}