import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { auth, logout, ui } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [pfpOk, setPfpOk] = useState(true)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
  })

  const onLogout = () => {
    logout()
    nav('/')
  }

  useEffect(() => {
    if (!auth.user) return
    ui.loadNotifications().catch(() => {})
    const t = setInterval(() => ui.loadNotifications().catch(() => {}), 20000)
    return () => clearInterval(t)
  }, [auth.user])

  useEffect(() => {
    try { localStorage.setItem('theme', theme) } catch {}
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
  }, [theme])

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
          {auth.user && <Link to="/profile">Profile</Link>}
          {auth.user?.role === 'author' || auth.user?.role === 'admin' ? (
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
              <button className="btn theme-toggle" aria-label="Toggle theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '☀️' : '🌙'}
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
                    {ui.unread > 0 && (
                      <button className="btn" onClick={() => ui.markAllRead()}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {ui.notifications.length === 0 ? (
                      <div className="muted" style={{ padding: '8px 0' }}>
                        No notifications
                      </div>
                    ) : (
                      ui.notifications.map((n) => (
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
              <button className="btn theme-toggle" aria-label="Toggle theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '☀️' : '🌙'}
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
