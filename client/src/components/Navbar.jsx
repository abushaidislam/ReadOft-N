import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Navbar() {
  const { auth, logout } = useAuth()
  const nav = useNavigate()
  const onLogout = () => {
    logout()
    nav('/')
  }
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">{import.meta.env.VITE_APP_NAME || 'Readoft'}</Link>
        <nav className="links">
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
        <div className="auth">
          {auth.user ? (
            <>
              <span className="user-chip">{auth.user.name} • {auth.user.role}</span>
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
