import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Home() {
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState(null)
  const [sort, setSort] = useState('-created_at') // '-created_at' | '-like_count'
  const [period, setPeriod] = useState('') // '', 'week', 'month'
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('heroMuted') !== 'false' } catch { return true }
  })
  const heroVideoRef = useRef(null)
  const onHeroSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchData().then(() => {
      const el = document.getElementById('feed')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }).catch(()=>{})
  }

  const fetchData = async () => {
    setLoading(true)
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
    setItems(data.items)
    setPageInfo(data.pageInfo || null)
    setLoading(false)
  }

  useEffect(() => { fetchData().catch(console.error) }, [page])
  useEffect(() => { fetchData().catch(console.error) }, [sort])
  useEffect(() => { request('/categories', { noGlobalLoading: true }).then(setCategories).catch(() => {}) }, [])
  useEffect(() => { try { localStorage.setItem('heroMuted', String(muted)) } catch {} }, [muted])

  return (
    <>
      <section className="hero">
        {/* Background video */}
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
            <h1 className="hero-title">Read. Write. Discover.</h1>
            <p className="hero-sub">Fresh articles from authors you follow and love.</p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#feed">Explore Articles</a>
            <a className="btn" href="/register">Join Free</a>
          </div>
            <form className="hero-search" onSubmit={onHeroSearch} role="search" aria-label="Search articles">
              <input
                className="hero-input"
                placeholder="Search for any article..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>
            <div className="hero-chips">
              {(categories.slice(0,6) || []).map((c) => (
                <button key={c.id} className="chip" type="button" onClick={() => { setCategory(c.slug); setPage(1); fetchData() }}>{c.name}</button>
              ))}
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
        <button className="btn" onClick={fetchData}>Apply</button>
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span className="muted">
              Page {pageInfo?.page || page} / {pageInfo?.totalPages || '?'}
            </span>
            <button className="btn" disabled={pageInfo && page >= pageInfo.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
    </>
  )}
