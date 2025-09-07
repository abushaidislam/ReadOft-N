import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useEffect } from 'react'
import { useState } from 'react'

export default function Navbar() {
  const { auth, logout, ui } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const onLogout = () => {
    logout()
    nav('/')
  }
  useEffect(() => { if (auth.user) ui.loadNotifications().catch(()=>{}) }, [auth.user])
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">{import.meta.env.VITE_APP_NAME || 'Readoft'}</Link>
        <button className="mobile-toggle" aria-label="Toggle menu" onClick={() => setOpen(v => !v)}>
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
              <button className="bell" aria-label="Notifications" onClick={() => { setShowNotif(s=>!s); if (!showNotif) ui.loadNotifications() }}>
                <span className="bell-ico">🔔</span>
                {ui.unread > 0 && <span className="notif-badge">{ui.unread}</span>}
              </button>
              {showNotif && (
                <div className="notif-menu" onMouseLeave={() => setShowNotif(false)}>
                  <div className="notif-head">
                    <strong>Notifications</strong>
                    {ui.unread > 0 && <button className="btn" onClick={() => ui.markAllRead()}>Mark all read</button>}
                  </div>
                  <div className="notif-list">
                    {ui.notifications.length === 0 ? (
                      <div className="muted" style={{padding:'8px 0'}}>No notifications</div>
                    ) : ui.notifications.map(n => (
                      <div key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => ui.markRead(n.id)}>
                        <NotifText n={n} />
                        <div className="muted" style={{fontSize:'.75rem'}}>{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Link to="/profile" className="nav-profile" title={auth.user.name} aria-label="Profile">
                {auth.user.avatar_url ? (
                  <img src={auth.user.avatar_url} alt="avatar" className="nav-avatar" />
                ) : (
                  <span className="nav-avatar nav-fallback">{(auth.user.name||'U').slice(0,1).toUpperCase()}</span>
                )}
              </Link>
              <button className="btn" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link className="btn" to="/login">Login</Link>
              <Link className="btn btn-primary" to="/register">Sign Up</Link>
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
  if (t === 'comment_on_article') return <span>New comment on <Link to={`/article/${p.article_id}`}>{p.title || 'your article'}</Link>: {p.excerpt || ''}</span>
  if (t === 'reply_to_comment') return <span>New reply on a comment — <Link to={`/article/${p.article_id}`}>view</Link></span>
  if (t === 'article_approved') return <span>Your article approved: <Link to={`/article/${p.article_id}`}>{p.title || 'Article'}</Link></span>
  return <span>Activity update</span>
}
