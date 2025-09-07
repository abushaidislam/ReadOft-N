import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const storageKey = 'readoft_auth'

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : { token: null, user: null }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(auth))
  }, [auth])

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`
    const res = await fetch(`${apiBase}${path}`, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }

  const login = async (email, password) => {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setAuth({ token: data.token, user: data.user })
  }

  const register = async (name, email, password) => {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
    setAuth({ token: data.token, user: data.user })
  }

  const logout = () => setAuth({ token: null, user: null })

  const value = useMemo(() => ({ auth, setAuth, login, register, logout, request }), [auth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

