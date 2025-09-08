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
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const esRef = useRef(null)

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
    const me = await request('/me', { headers: { Authorization: `Bearer ${data.token}` }, noGlobalLoading: true })
    setAuth({ token: data.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
  }

  const register = async (name, email, password) => {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
    const me = await request('/me', { headers: { Authorization: `Bearer ${data.token}` }, noGlobalLoading: true })
    setAuth({ token: data.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
  }

  const logout = () => setAuth({ token: null, user: null })

  async function loadNotifications() {
    try {
      const data = await request('/notifications', { noGlobalLoading: true })
      setNotifs(Array.isArray(data) ? data : [])
      setUnread((data || []).filter((n) => !n.is_read).length)
    } catch {}
  }
  async function markAllRead() {
    try { await request('/notifications/read-all', { method: 'POST' }); setNotifs((prev)=>prev.map(n=>({ ...n, is_read:true }))); setUnread(0) } catch {}
  }
  async function markRead(id) {
    try { await request(`/notifications/${id}/read`, { method: 'POST' }); setNotifs((prev)=>prev.map(n=>n.id===id?{...n,is_read:true}:n)); setUnread((c)=>Math.max(0,c-1)) } catch {}
  }

  function startNotifStream() {
    try {
      if (!auth.token || esRef.current) return
      const url = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api') + `/notifications/stream?token=${encodeURIComponent(auth.token)}`
      const es = new EventSource(url)
      es.onmessage = (ev) => {
        try {
          const n = JSON.parse(ev.data)
          setNotifs((prev) => [n, ...prev].slice(0, 100))
          if (!n.is_read) setUnread((c) => c + 1)
        } catch {}
      }
      es.onerror = () => {
        try { es.close() } catch {}
        esRef.current = null
        setTimeout(startNotifStream, 3000)
      }
      esRef.current = es
    } catch {}
  }
  function stopNotifStream() {
    try { esRef.current?.close() } catch {}
    esRef.current = null
  }

  useEffect(() => {
    if (auth.token) startNotifStream(); else stopNotifStream()
    return () => stopNotifStream()
  }, [auth.token])

  // Ensure we always have a fresh copy of user/role when a token exists
  useEffect(() => {
    if (!auth.token) return
    // Fetch /me silently and update local role/avatar/name if changed
    request('/me', { noGlobalLoading: true })
      .then((me) => {
        const existing = auth.user || {}
        if (!existing || existing.role !== me.role || existing.name !== me.name || existing.avatar_url !== me.avatar_url) {
          setAuth({ token: auth.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
        }
      })
      .catch(() => {})
    // run only when token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  // Refresh user on window focus to capture role changes without logout
  useEffect(() => {
    const onFocus = () => {
      if (!auth.token) return
      request('/me', { noGlobalLoading: true })
        .then((me) => {
          const existing = auth.user || {}
          if (!existing || existing.role !== me.role || existing.name !== me.name || existing.avatar_url !== me.avatar_url) {
            setAuth({ token: auth.token, user: { id: me.id, email: me.email, name: me.name, role: me.role, avatar_url: me.avatar_url } })
          }
        })
        .catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [auth.token, auth.user])

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
      notifications: notifs,
      unread,
      loadNotifications,
      markAllRead,
      markRead,
      startNotifStream,
      stopNotifStream,
    }
  }), [auth, busyCount, toasts, notifs, unread])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
