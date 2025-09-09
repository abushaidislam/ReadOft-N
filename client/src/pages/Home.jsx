import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import useMeta from '../utils/useMeta.js'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Home() {
  const { request } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState(null)
  const [sort, setSort] = useState('-created_at') // '-created_at' | '-like_count'
  const [period, setPeriod] = useState('') // '', 'week', 'month'
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('heroMuted') !== 'false' } catch { return true }
  })
  const heroVideoRef = useRef(null)
  const heroSearchRef = useRef(null)
  const sentinelRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [supportsIO] = useState(() => typeof window !== 'undefined' && 'IntersectionObserver' in window)
  const trending = ['website development', 'architecture & interior design', 'UGC videos', 'video editing', 'vibe coding']
  const onHeroSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchData(true).then(() => {
      const el = document.getElementById('feed')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }).catch(()=>{})
  }

  const fetchData = async (reset = false) => {
    if (reset) setLoading(true)
    else if (page > 1) setLoadingMore(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    if (category) params.set('category', category)
    params.set('page', String(page))
    params.set('limit', '12')
    params.set('sort', String(sort))
    if (period) params.set('period', period)
    const endpoint = q ? '/search' : '/articles'
    const data = await request(`${endpoint}?${params.toString()}`, { noGlobalLoading: true })
    setItems((prev) => (reset || page === 1 ? data.items : [...prev, ...data.items]))
    setPageInfo(data.pageInfo || null)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => { fetchData(page === 1).catch(console.error) }, [page])
  useEffect(() => { setPage(1); fetchData(true).catch(console.error) }, [sort, period])
  useEffect(() => { request('/categories', { noGlobalLoading: true }).then(setCategories).catch(() => {}) }, [])
  useEffect(() => { try { localStorage.setItem('heroMuted', String(muted)) } catch {} }, [muted])
  useMeta({ title: `${import.meta.env.VITE_APP_NAME || 'Readoft'} — Discover our Recent blog article`, description: 'Find the perfect service for your project.', canonical: '/' })

  // live suggestions for hero search (articles + categories + authors)
  useEffect(() => {
    let t
    if (q && q.trim().length >= 2) {
      t = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ q: q.trim(), page: '1', limit: '5', sort: '-like_count' })
          const [articles, authors] = await Promise.all([
            request(`/search?${params.toString()}`, { noGlobalLoading: true }).then(r => r.items || []).catch(() => []),
            request(`/authors/search?q=${encodeURIComponent(q.trim())}&limit=5`, { noGlobalLoading: true }).catch(() => []),
          ])
          const cats = (categories || []).filter(c => (c.name || '').toLowerCase().includes(q.trim().toLowerCase()) || (c.slug || '').toLowerCase().includes(q.trim().toLowerCase())).slice(0,5)
          const combined = []
          if (articles.length) combined.push({ type:'label', text:'Articles' }, ...articles.map(a => ({ type:'article', item:a })))
          if (cats.length) combined.push({ type:'label', text:'Categories' }, ...cats.map(c => ({ type:'category', item:c })))
          if (Array.isArray(authors) && authors.length) combined.push({ type:'label', text:'Authors' }, ...authors.map(u => ({ type:'author', item:u })))
          setSuggestions(combined)
          setShowSuggest(true)
          setActiveIdx(0)
        } catch { setSuggestions([]); setShowSuggest(false) }
      }, 250)
    } else {
      setSuggestions([])
      setShowSuggest(false)
    }
    return () => t && clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!heroSearchRef.current) return
      if (!heroSearchRef.current.contains(e.target)) setShowSuggest(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // Infinite scroll observer
  useEffect(() => {
    if (!supportsIO) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      const first = entries[0]
      const totalPages = pageInfo?.totalPages || 1
      if (first.isIntersecting && !loading && !loadingMore && page < totalPages) {
        setPage((p) => p + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [pageInfo, loading, loadingMore, supportsIO])

  return (
    <>
      <section className="hero">
        {/* Background video */}
        <video
          className="hero-video-blur"
          src="/Hero (1).mp4"
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <video
          ref={heroVideoRef}
          className="hero-video-bg"
          src="/Hero (1).mp4"
          muted={muted}
          autoPlay
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <div className="hero-overlay" aria-hidden="true" />
        <button
          type="button"
          className="hero-audio-toggle"
          aria-label={muted ? 'Unmute hero video' : 'Mute hero video'}
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? 'Sound Off' : 'Sound On'}
        </button>
        <div className="container">
          <div className="hero-inner">
            <h1 className="hero-title">Discover our Recent Blog Article</h1>
            <form ref={heroSearchRef} className="hero-search" onSubmit={onHeroSearch} role="search" aria-label="Search services">
              <Search className="hero-search-icon" aria-hidden="true" />
              <input
                className="hero-input"
                placeholder="Search for any service..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setShowSuggest(true) }}
                onKeyDown={(e) => {
                  if (!showSuggest || suggestions.length === 0) return
                  const nextIdx = (dir) => {
                    let i = activeIdx
                    while (true) {
                      i = Math.max(0, Math.min(suggestions.length - 1, i + dir))
                      if (suggestions[i]?.type !== 'label') return i
                      if (i === 0 || i === suggestions.length - 1) return i
                    }
                  }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => nextIdx(1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => nextIdx(-1)) }
                  else if (e.key === 'Enter') {
                    if (activeIdx >= 0) {
                      e.preventDefault()
                      const s = suggestions[activeIdx]
                      if (s.type === 'article') navigate(s.item.slug ? `/a/${s.item.slug}` : `/article/${s.item.id}`)
                      else if (s.type === 'category') { setCategory(s.item.slug); setShowSuggest(false); setPage(1); fetchData(true) }
                      else if (s.type === 'author') navigate(`/author/${s.item.id}`)
                      setShowSuggest(false)
                    }
                  }
                  else if (e.key === 'Escape') { setShowSuggest(false) }
                }}
              />
              <button className="hero-search-btn" type="submit" aria-label="Search">
                <ArrowRight size={20} />
              </button>
              {showSuggest && suggestions.length > 0 && (
                <div className="suggest">
                  {suggestions.map((s, i) => (
                    s.type === 'label' ? (
                      <div key={`lbl-${i}`} className="suggest-label">{s.text}</div>
                    ) : s.type === 'article' ? (
                      <button key={s.item.id} type="button" className={`suggest-item ${i === activeIdx ? 'active' : ''}`} onClick={() => navigate(s.item.slug ? `/a/${s.item.slug}` : `/article/${s.item.id}`)}>
                        <span className="title">{s.item.title}</span>
                        <span className="meta">{new Date(s.item.created_at).toLocaleDateString()}</span>
                      </button>
                    ) : s.type === 'category' ? (
                      <button key={s.item.id} type="button" className={`suggest-item ${i === activeIdx ? 'active' : ''}`} onClick={() => { setCategory(s.item.slug); setShowSuggest(false); setPage(1); fetchData(true) }}>
                        <span className="title">#{s.item.name}</span>
                        <span className="meta">Category</span>
                      </button>
                    ) : (
                      <button key={s.item.id} type="button" className={`suggest-item ${i === activeIdx ? 'active' : ''}`} onClick={() => navigate(`/author/${s.item.id}`)}>
                        <span className="title">{s.item.name}</span>
                        <span className="meta">Author</span>
                      </button>
                    )
                  ))}
                </div>
              )}
            </form>
            <div className="hero-chips">
              {trending.map((t) => (
                <button key={t} className="chip" type="button" onClick={() => { setQ(t); setShowSuggest(false) }}>{t}</button>
              ))}
            </div>
            <div className="trusted-by">
              <span className="muted">Trusted by:</span>
              <ul className="trusted-list">
                <li>Meta</li>
                <li>Google</li>
                <li>Netflix</li>
                <li>P&amp;G</li>
                <li>PayPal</li>
                <li>Payoneer</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="hero-glow" aria-hidden="true" />
      </section>
      <div className="container page">
      <div className="tabs" style={{ marginTop: 12 }}>
        <button className={`tab ${sort === '-created_at' && !period ? 'active' : ''}`} onClick={() => { setSort('-created_at'); setPeriod(''); setPage(1) }}>Latest</button>
        <button className={`tab ${sort === '-like_count' && !period ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod(''); setPage(1) }}>Trending</button>
        <button className={`tab ${period === 'week' ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod('week'); setPage(1) }}>This Week</button>
        <button className={`tab ${period === 'month' ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod('month'); setPage(1) }}>This Month</button>
      </div>
      <div className="filters">
        <input placeholder="Search title..." value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option value={c.slug} key={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn" onClick={() => { setPage(1); fetchData(true) }}>Apply</button>
      </div>
      {loading ? (
        <div className="grid" id="feed">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="card skeleton" key={i}>
              <div className="skeleton-thumb" />
              <div className="skeleton-line w-80" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-row">
                <span className="skeleton-chip" />
                <span className="skeleton-chip" />
                <span className="skeleton-chip" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid" id="feed">
            {items.map((a, idx) => <ArticleCard article={a} key={a.id} index={idx} />)}
          </div>
          <div ref={sentinelRef} style={{ display:'flex', justifyContent:'center', marginTop:16, paddingBottom:16 }}>
            {supportsIO ? (
              loadingMore ? <div className="spinner" aria-label="Loading more" /> : (
                <span className="muted">{pageInfo && page >= (pageInfo.totalPages || 1) ? 'No more results' : ''}</span>
              )
            ) : (
              <button className="btn" disabled={loadingMore || (pageInfo && page >= (pageInfo.totalPages || 1))} onClick={() => setPage((p) => p + 1)}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </>
  )}
