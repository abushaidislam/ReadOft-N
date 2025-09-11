import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export default function Subnav() {
  const loc = useLocation()
  const nav = useNavigate()
  const show = loc.pathname !== '/'
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const lastTick = useRef(0)

  // Hide subnav on scroll down, show on scroll up
  useEffect(() => {
    if (!show) return
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY.current
      const now = Date.now()
      if (Math.abs(delta) > 4 && now - lastTick.current > 80) {
        setHidden(y > 80 && delta > 0)
        lastTick.current = now
        lastY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [show])
  useEffect(() => { setHidden(false) }, [loc.pathname])

  const goBack = () => {
    try {
      if (window.history.length > 2) nav(-1)
      else nav('/')
    } catch { nav('/') }
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

  const isArticle = /^\/(article|a)\//i.test(loc.pathname)
  const goTOC = () => {
    try {
      const toc = document.querySelector('.toc')
      if (toc) { toc.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
      const first = document.querySelector('.markdown h2, .markdown h3')
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {}
  }

  if (!show) return null
  return (
    <div className={`subnav ${hidden ? 'hidden' : ''}`}>
      <div className="container subnav-inner">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="btn icon-btn" onClick={goBack} aria-label="Go back" title="Back">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>
          </button>
        </div>
        <nav className="crumbs" aria-label="Breadcrumb">
          {items.map((it, idx) => (
            <span key={idx} className="crumb">
              {idx === items.length - 1 ? (
                <span className="current" aria-current="page">{it.label}</span>
              ) : (
                <Link to={it.to}>{it.label}</Link>
              )}
              {idx < items.length - 1 && <span className="sep">›</span>}
            </span>
          ))}
        </nav>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isArticle && (
            <button className="btn icon-btn" onClick={goTOC} aria-label="Contents" title="Contents">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z"></path></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function labelFor(base, next) {
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

