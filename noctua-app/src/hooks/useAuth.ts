// noctua-app/src/hooks/useAuth.ts
import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000/api'

// Lee el token síncronamente UNA SOLA VEZ al importar el módulo.
// Esto evita el flicker: cuando React monta el árbol, el token
// ya está disponible desde el primer render — no hay "primer render
// sin token" que dispare un redirect a login.
const initialToken = localStorage.getItem('token')
const initialUser  = (() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

export function useAuth() {
  const [user,  setUser]  = useState(initialUser)
  const [token, setToken] = useState(initialToken)

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${API}/login`, { email, password })
    const { token: t, user: u } = res.data
    localStorage.setItem('token', t)
    localStorage.setItem('user',  JSON.stringify(u))
    setToken(t)
    setUser(u)
    return res.data
  }

  const logout = async () => {
    try {
      await axios.post(`${API}/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {
      // ignorar errores de red al hacer logout
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  // isAuthenticated es derivado — nunca es undefined ni pasa por
  // un estado intermedio "false antes de leer localStorage"
  const isAuthenticated = !!token

  return { user, token, login, logout, isAuthenticated }
}