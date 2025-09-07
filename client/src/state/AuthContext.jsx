import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const AuthContext = createContext(null)

const storageKey = 'readoft_auth'

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : { token: null, user: null }
  })
  const [busyCount, setBusyCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(1)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(auth))
  }, [auth])

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

  function notify(message, type = 'info', duration = 3000) {
    const id = toastId.current++
    setToasts((t) => [...t, { id, message, type }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }

  function dismiss(id) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  async function request(path, options = {}) {
    const noGlobalLoading = options.noGlobalLoading === true
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`
    if (!noGlobalLoading) setBusyCount((c) => c + 1)
    try {
      const res = await fetch(`${apiBase}${path}`, { ...options, headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Request failed')
      return data
    } catch (e) {
      notify(e.message || 'Request failed', 'error')
      throw e
    } finally {
      if (!noGlobalLoading) setBusyCount((c) => Math.max(0, c - 1))
    }
  }

  const login = async (email, password) => {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    // fetch full profile to get avatar_url etc.
    const me = await request('/me', { headers: { Authorization: `Bearer ${data.token}` }, noGlobalLoading: true })
    setAuth({ token: data.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
  }

  const register = async (name, email, password) => {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
    const me = await request('/me', { headers: { Authorization: `Bearer ${data.token}` }, noGlobalLoading: true })
    setAuth({ token: data.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
  }

  const logout = () => setAuth({ token: null, user: null })

  const value = useMemo(() => ({
    auth,
    setAuth,
    login,
    register,
    logout,
    request,
    ui: {
      busy: busyCount > 0,
      toasts,
      notify,
      dismiss,
    }
  }), [auth, busyCount, toasts])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
