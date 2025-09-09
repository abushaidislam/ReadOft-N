import { useLocation, useNavigate, Link } from 'react-router-dom'
import Button from './Button.jsx'

export default function Subnav() {
  const loc = useLocation()
  const nav = useNavigate()
  const show = loc.pathname !== '/'
  const goBack = () => {
    try {
      if (window.history.length > 2) nav(-1)
      else nav('/')
    } catch { nav('/') }
  }
  const goForward = () => {
    try { nav(1) } catch {}
  }
  const parts = loc.pathname.split('/').filter(Boolean)
  const items = [{ label: 'Home', to: '/' }]
  let path = ''
  for (let i = 0; i < parts.length; i++) {
    path += '/' + parts[i]
    const p = parts[i]
    const base = p.toLowerCase()
    const label = labelFor(base, parts[i + 1])
    items.push({ label, to: path })
  }
  if (!show) return null
  return (
    <div className="subnav">
      <div className="container subnav-inner">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Button className="back-btn" onClick={goBack} aria-label="Go back">← Back</Button>
          <Button onClick={goForward} aria-label="Go forward">Forward →</Button>
        </div>
        <nav className="crumbs" aria-label="Breadcrumb">
          {items.map((it, idx) => (
            <span key={idx} className="crumb">
              {idx === items.length - 1 ? (
                <span className="current" aria-current="page">{it.label}</span>
              ) : (
                <Link to={it.to}>{it.label}</Link>
              )}
              {idx < items.length - 1 && <span className="sep">/</span>}
            </span>
          ))}
        </nav>
      </div>
    </div>
  )
}

function labelFor(base, _next) {
  if (base === 'a' || base === 'article') return 'Article'
  if (base === 'category') return 'Category'
  if (base === 'author') return 'Author'
  if (base === 'dashboard') return 'Dashboard'
  if (base === 'editor') return 'Editor'
  if (base === 'feed') return 'Feed'
  if (base === 'profile') return 'Profile'
  if (base === 'admin') return 'Admin'
  // generic: prettify id/slug
  try {
    const s = decodeURIComponent(base)
    if (/^[a-f0-9-]{8,}$/.test(s)) return s.slice(0,8) + '…'
    return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
  } catch { return base }
}

