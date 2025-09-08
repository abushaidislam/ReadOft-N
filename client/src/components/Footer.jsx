import { Link } from 'react-router-dom'
import Button from './Button.jsx'

export default function Footer() {
  const year = new Date().getFullYear()
  const app = import.meta.env.VITE_APP_NAME || 'Readoft'
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="foot-col brand-col">
          <Link to="/" className="foot-brand" aria-label="Home">
            <img src="/logo.png" alt={app} className="brand-logo" />
            <span className="sr-only">{app}</span>
          </Link>
          <p className="muted" style={{ marginTop: 8 }}>Read. Write. Discover. A modern platform for readers and authors.</p>
        </div>
        <div className="foot-col">
          <strong>Explore</strong>
          <nav className="foot-links">
            <Link to="/">Home</Link>
            <Link to="/categories">Categories</Link>
            <Link to="/feed">Feed</Link>
            <Link to="/register">Join</Link>
          </nav>
        </div>
        <div className="foot-col">
          <strong>Resources</strong>
          <nav className="foot-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/editor">Write</Link>
            <a href="#feed">Top Articles</a>
          </nav>
        </div>
        <div className="foot-col">
          <strong>Company</strong>
          <nav className="foot-links">
            <a href="mailto:support@example.com">Support</a>
            <a href="#" onClick={(e)=>e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e)=>e.preventDefault()}>Terms</a>
          </nav>
        </div>
      </div>
      <div className="container footer-bottom">
        <span className="muted">© {year} {app}. All rights reserved.</span>
        <Button as="a" href="#top" onClick={(e)=>{ e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Back to top ↑</Button>
      </div>
    </footer>
  )
}

