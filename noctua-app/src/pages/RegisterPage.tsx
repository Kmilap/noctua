import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API = 'http://localhost:8000/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    try {
      await axios.post(`${API}/register`, {
        name,
        email,
        password,
        password_confirmation: confirmation,
      })
      navigate('/login')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al registrarse.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
      <div className="bg-[#1A1A2E] rounded-2xl p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            noct<span className="text-[#EF9F27]">u</span>a
          </h1>
          <p className="text-gray-500 text-sm mt-1">Crear cuenta</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            className="bg-[#0F0E17] text-white rounded-lg px-4 py-3 outline-none border border-[#26215C] focus:border-[#EF9F27] transition-colors"
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            className="bg-[#EF9F27] text-black font-semibold rounded-lg py-3 hover:bg-[#d4891f] transition-colors disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
          <Link to="/login" className="text-center text-sm text-gray-500 hover:text-gray-300">
            ¿Ya tenés cuenta? Iniciá sesión
          </Link>
        </div>
      </div>
    </div>
  )
}