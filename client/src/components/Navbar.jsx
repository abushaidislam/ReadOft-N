import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useEffect, useRef, useState } from 'react'

export default function Navbar() {
  const { auth, logout, ui } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all') // all | unread
  const [pfpOk, setPfpOk] = useState(true)
  const [themePref, setThemePref] = useState(() => getInitialThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(getInitialThemePreference()))

  const onLogout = () => {
    logout()
    nav('/')
  }

  // Keep a stable ref for ui to avoid effect loops when notifications update
  const uiRef = useRef(ui)
  useEffect(() => { uiRef.current = ui }, [ui])
  useEffect(() => {
    if (!auth.user) return
    uiRef.current.loadNotifications().catch((e) => { if (import.meta.env.DEV) console.debug('load notifs failed', e) })
    const t = setInterval(() => uiRef.current.loadNotifications().catch((e) => { if (import.meta.env.DEV) console.debug('interval notifs failed', e) }), 20000)
    return () => clearInterval(t)
  }, [auth.user])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}
    const resolved = resolveTheme(themePref)
    setResolvedTheme(resolved)
    try { localStorage.setItem('theme', themePref) } catch (e) { if (import.meta.env.DEV) console.debug('persist theme failed', e) }
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    if (resolved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    window.dispatchEvent(new CustomEvent('theme-preference-change', { detail: { preference: themePref, resolved } }))
    let cleanup = () => {}
    if (themePref === 'system' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (event) => {
        const next = event.matches ? 'dark' : 'light'
        setResolvedTheme(next)
        root.setAttribute('data-theme', next)
        if (next === 'dark') root.classList.add('dark')
        else root.classList.remove('dark')
      }
      media.addEventListener('change', handler)
      cleanup = () => media.removeEventListener('change', handler)
    }
    return cleanup
  }, [themePref])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}
    const handler = (event) => {
      const pref = event.detail?.preference
      if (pref && pref !== themePref) setThemePref(pref)
    }
    window.addEventListener('theme-preference-change', handler)
    return () => window.removeEventListener('theme-preference-change', handler)
  }, [themePref])

  return (
    <header className="nav">
      <div className="container nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand" aria-label="Home">
            <img src="/logo.png" alt={import.meta.env.VITE_APP_NAME || 'Readoft'} className="brand-logo" />
          </Link>
        </div>
        <button className="mobile-toggle" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
          <span className={open ? 'bar rotate-45' : 'bar'}></span>
          <span className={open ? 'bar opacity-0' : 'bar'}></span>
          <span className={open ? 'bar -rotate-45' : 'bar'}></span>
        </button>
        <nav className={`links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          <Link to="/">Home</Link>
          {auth.user && <Link to="/feed">Feed</Link>}
          <Link to="/categories">Categories</Link>
          <Link to="/authors">Authors</Link>
          {auth.user && auth.user.role !== 'admin' && <Link to="/profile">Profile</Link>}
          {auth.user?.role === 'author' ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/editor">New Post</Link>
            </>
          ) : null}
          {auth.user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        </nav>
        <div className={`auth ${open ? 'open' : ''}`}>
          {auth.user ? (
            <>
              <button className="theme-toggle" aria-label={`Toggle theme (current ${resolvedTheme})`} onClick={() => setThemePref(t => t === 'dark' ? 'light' : 'dark')}>
                <span className="toggle-icon">☀️</span>
                <span className="toggle-icon">🌙</span>
              </button>
              <button
                className="bell"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotif((s) => !s)
                  if (!showNotif) ui.loadNotifications()
                }}
              >
                <span className="bell-ico">🔔</span>
                {ui.unread > 0 && <span className="notif-badge">{ui.unread}</span>}
              </button>
              {showNotif && (
                <div className="notif-menu" onMouseLeave={() => setShowNotif(false)}>
                  <div className="notif-head">
                    <strong>Notifications</strong>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className="notif-tabs" role="tablist" aria-label="Filter notifications">
                        <button className={`notif-tab ${notifFilter==='all'?'active':''}`} role="tab" aria-selected={notifFilter==='all'} onClick={()=>setNotifFilter('all')}>All ({ui.notifications.length})</button>
                        <button className={`notif-tab ${notifFilter==='unread'?'active':''}`} role="tab" aria-selected={notifFilter==='unread'} onClick={()=>setNotifFilter('unread')}>Unread ({ui.unread})</button>
                      </div>
                      {ui.unread > 0 && (
                        <button className="btn" onClick={() => ui.markAllRead()}>
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="notif-list">
                    {ui.loadingNotifications ? (
                      // Show skeleton loading
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="notif-skeleton">
                          <div className="skeleton-avatar"></div>
                          <div className="skeleton-content">
                            <div className="skeleton-line medium"></div>
                            <div className="skeleton-line short"></div>
                            <div className="skeleton-line long"></div>
                          </div>
                          <div className="skeleton-thumb"></div>
                        </div>
                      ))
                    ) : (notifFilter==='unread' ? ui.notifications.filter(n=>!n.is_read) : ui.notifications).length === 0 ? (
                      <div className="muted" style={{ padding: '12px 0', textAlign: 'center' }}>
                        No {notifFilter==='unread' ? 'unread ' : ''}notifications
                      </div>
                    ) : (
                      (notifFilter==='unread' ? ui.notifications.filter(n=>!n.is_read) : ui.notifications).map((n) => (
                        <NotifItem key={n.id} n={n} onRead={() => ui.markRead(n.id)} />
                      ))
                    )}
                  </div>
                </div>
              )}
              <Link to="/profile" className="nav-profile" title={auth.user.name} aria-label="Profile">
                {auth.user.avatar_url && pfpOk ? (
                  <img
                    src={auth.user.avatar_url}
                    alt="avatar"
                    className="nav-avatar"
                    onError={() => setPfpOk(false)}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="nav-avatar nav-fallback">{(auth.user.name || 'U').slice(0, 1).toUpperCase()}</span>
                )}
              </Link>
              <button className="btn" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="theme-toggle" aria-label={`Toggle theme (current ${resolvedTheme})`} onClick={() => setThemePref(t => t === 'dark' ? 'light' : 'dark')}>
                <span className="toggle-icon">☀️</span>
                <span className="toggle-icon">🌙</span>
              </button>
              <Link className="btn" to="/login">
                Login
              </Link>
              <Link className="btn btn-primary" to="/register">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}


function getInitialThemePreference() {
  if (typeof window === 'undefined') return 'light'
  try { return localStorage.getItem('theme') || 'light' } catch { return 'light' }
}

function resolveTheme(preference) {
  if (preference === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference === 'dark' ? 'dark' : 'light'
}

function NotifText({ n }) {
  const t = n.type
  const p = n.payload || {}
  if (t === 'comment_on_article')
    return (
      <span>
        New comment on <Link to={`/article/${p.article_id}`}>{p.title || 'your article'}</Link>: {p.excerpt || ''}
      </span>
    )
  if (t === 'reply_to_comment')
    return (
      <span>
        New reply on a comment — <Link to={`/article/${p.article_id}`}>view</Link>
      </span>
    )
  if (t === 'article_approved')
    return (
      <span>
        Your article approved: <Link to={`/article/${p.article_id}`}>{p.title || 'Article'}</Link>
      </span>
    )
  if (t === 'article_rejected')
    return (
      <span>
        Your article was rejected{p.reason ? `: ${p.reason}` : ''}
      </span>
    )
  if (t === 'new_post_by_followed_author')
    return (
      <span>
        New post: <Link to={`/article/${p.article_id}`}>{p.title || 'Article'}</Link>
      </span>
    )
  if (t === 'pending_article_submitted')
    return (
      <span>
        Review requested: <Link to="/admin">{p.title || 'Article'}</Link> by {p.author_name || 'author'}
      </span>
    )
  if (t === 'author_role_request')
    return (
      <span>
        Author application from {p.name || 'User'}
      </span>
    )
  return <span>Activity update</span>
}

function NotifItem({ n, onRead }) {
  const p = n.payload || {}
  const hasThumb = Boolean(p.thumbnail_url)
  const hasAuthor = Boolean(p.author_name || p.author_avatar_url)
  return (
    <div className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={onRead}>
      <div className="notif-media">
        {hasAuthor ? (
          p.author_avatar_url ? (
            <img className="notif-avatar" src={p.author_avatar_url} alt="author" loading="lazy" decoding="async" />
          ) : (
            <span className="notif-avatar notif-fallback">{(p.author_name || 'A').slice(0, 1).toUpperCase()}</span>
          )
        ) : (
          <span className="notif-avatar notif-fallback">N</span>
        )}
        <div className="notif-content">
          <div className="notif-text">
            <NotifText n={n} />
            {hasAuthor && <div className="muted" style={{ fontSize: '.75rem' }}>by {p.author_name}</div>}
          </div>
          <div className="muted" style={{ fontSize: '.75rem' }}>{new Date(n.created_at).toLocaleString()}</div>
        </div>
        {hasThumb && <img className="notif-thumb" src={p.thumbnail_url} alt="thumb" loading="lazy" decoding="async" />}
      </div>
    </div>
  )
}
