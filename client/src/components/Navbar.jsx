import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useState } from 'react'

export default function Navbar() {
  const { auth, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const onLogout = () => {
    logout()
    nav('/')
  }
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
