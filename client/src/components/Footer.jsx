import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function Footer() {
  const { request, ui } = useAuth()
  const year = new Date().getFullYear()
  const app = import.meta.env.VITE_APP_NAME || 'Readoft'
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubscribe = async (e) => {
    e.preventDefault()
    const v = String(email || '').trim()
    if (!v) { ui?.notify?.('Please enter your email', 'error'); return }
    setBusy(true)
    try {
      await request('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email: v }), noGlobalLoading: true })
      ui?.notify?.('Subscribed! Check your inbox soon.', 'success')
      setEmail('')
    } catch (err) {
      ui?.notify?.(err?.message || 'Subscription failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-cta">
        <div className="container footer-cta-inner">
          <div className="footer-cta-copy">
            <span className="eyebrow">Stay in the loop</span>
            <h2>Join {app}'s weekly digest</h2>
            <p className="muted">Curated stories, emerging voices, and reading recommendations delivered every Sunday.</p>
          </div>
          <form onSubmit={onSubscribe} className="footer-form">
            <div className="input-wrap">
              <label htmlFor="footer-email" className="sr-only">Email for newsletter</label>
              <input
                id="footer-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="foot-brand" aria-label="Home">
            <img src="/logo.png" alt={app} className="brand-logo" />
            <span className="sr-only">{app}</span>
          </Link>
          <p className="muted">Read. Write. Discover. A modern platform where readers meet storytellers and ideas find their audience.</p>
          <div className="footer-social" aria-label="Social links">
            <a className="social-btn" href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.26 4.26 0 001.87-2.35 8.49 8.49 0 01-2.7 1.03 4.24 4.24 0 00-7.22 3.87 12.03 12.03 0 01-8.73-4.43 4.24 4.24 0 001.31 5.66 4.2 4.2 0 01-1.92-.53v.05a4.24 4.24 0 003.4 4.16 4.25 4.25 0 01-1.91.07 4.24 4.24 0 003.95 2.94A8.5 8.5 0 012 19.54 12 12 0 008.29 21c7.55 0 11.68-6.26 11.68-11.68 0-.18-.01-.36-.02-.54A8.35 8.35 0 0022.46 6z"></path></svg>
            </a>
            <a className="social-btn" href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.9 5.33.9 11.6c0 4.86 3.15 8.98 7.51 10.43.55.1.75-.24.75-.53 0-.26-.01-1.14-.02-2.07-3.06.66-3.71-1.3-3.71-1.3-.5-1.26-1.23-1.6-1.23-1.6-1-.68.08-.66.08-.66 1.1.08 1.68 1.13 1.68 1.13.99 1.69 2.6 1.2 3.24.92.1-.72.39-1.2.7-1.48-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.17 1.12-2.94-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.05 1.12a10.6 10.6 0 015.56 0c2.12-1.42 3.05-1.12 3.05-1.12.6 1.53.22 2.66.11 2.94.69.77 1.12 1.74 1.12 2.94 0 4.22-2.57 5.15-5.02 5.43.4.34.75 1.01.75 2.04 0 1.47-.01 2.65-.01 3.01 0 .29.2.63.76.52 4.35-1.45 7.5-5.57 7.5-10.43C23.1 5.33 18.27.5 12 .5z"></path></svg>
            </a>
            <a className="social-btn" href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 8.98h3.96V21H3V8.98zM9.5 8.98H13v1.62h.05c.49-.93 1.7-1.9 3.5-1.9 3.75 0 4.45 2.47 4.45 5.67V21H17v-4.98c0-1.19-.02-2.72-1.66-2.72-1.67 0-1.93 1.3-1.93 2.64V21H9.5V8.98z"></path></svg>
            </a>
          </div>
          <div className="footer-metric">Trusted by 20k+ readers globally.</div>
        </div>
        <div className="footer-links">
          <div className="foot-col">
            <strong>Explore</strong>
            <nav className="foot-links">
              <Link to="/">Home</Link>
              <Link to="/categories">Categories</Link>
              <Link to="/feed">Feed</Link>
              <Link to="/register">Join community</Link>
            </nav>
          </div>
          <div className="foot-col">
            <strong>Create</strong>
            <nav className="foot-links">
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/editor">Write</Link>
              <a href="#feed">Top articles</a>
            </nav>
          </div>
          <div className="foot-col">
            <strong>Support</strong>
            <nav className="foot-links">
              <a href="mailto:support@example.com">Email support</a>
              <Link to="/contact">Contact</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span className="muted">&copy; {year} {app}. All rights reserved.</span>
        <div className="footer-bottom-links">
          <a href="#top" className="btn-link" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Back to top</a>
        </div>
      </div>
    </footer>
  )
}
