import { useEffect, useState } from 'react'
import api from '../lib/api'

let _token = localStorage.getItem('token')
let _user  = (() => {
  try { const r = localStorage.getItem('user'); return r ? JSON.parse(r) : null }
  catch { return null }
})()

const listeners = new Set<() => void>()
const notify = () => listeners.forEach(fn => fn())

export function useAuth() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const trigger = () => rerender(n => n + 1)
    listeners.add(trigger)
    return () => { listeners.delete(trigger) }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/login', { email, password })
    _token = res.data.token
    _user  = res.data.user
    localStorage.setItem('token', _token!)
    localStorage.setItem('user',  JSON.stringify(_user))
    notify()
    return res.data
  }

  const logout = async () => {
    try {
      await api.post('/logout', {})
    } catch { /* ignorar */ }
    _token = null
    _user  = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    notify()
  }

  return { user: _user, token: _token, login, logout, isAuthenticated: !!_token }
}
