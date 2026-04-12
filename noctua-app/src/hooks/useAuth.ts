import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000/api'

export function useAuth() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${API}/login`, { email, password })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    setToken(res.data.token)
    setUser(res.data.user)
    return res.data
  }

  const logout = async () => {
    await axios.post(`${API}/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const isAuthenticated = !!token

  return { user, token, login, logout, isAuthenticated }
}