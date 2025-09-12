import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Tag() {
  const { tag } = useParams()
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState(null)
  const [sort, setSort] = useState('-created_at') // '-created_at' | '-like_count'
  const [period, setPeriod] = useState('') // '', 'week', 'month'
  const sentinelRef = useRef(null)

  const fetchData = useCallback(async (reset = false) => {
    if (reset) setLoading(true); else if (page > 1) setLoadingMore(true)
    const params = new URLSearchParams()
    params.set('tag', tag)
    params.set('page', String(page))
    params.set('limit', '12')
    params.set('sort', sort)
    if (period) params.set('period', period)
    const data = await request(`/articles?${params.toString()}`, { noGlobalLoading: true })
    setItems(prev => (reset || page === 1 ? (data.items || []) : [...prev, ...(data.items || [])]))
    setPageInfo(data.pageInfo || null)
    setLoading(false); setLoadingMore(false)
  }, [tag, page, sort, period, request])

  // Reset to first page when tag/sort/period changes
  useEffect(() => { setPage(1) }, [tag, sort, period])
  // Fetch whenever page changes
  useEffect(() => { fetchData(page === 1).catch(() => {}) }, [page, fetchData])

  return (
    <div className="container page">
      <div className="page-head" style={{ marginBottom: 12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Tag: <span style={{ color:'var(--primary)' }}>#{tag}</span></h2>
          <div className="muted" style={{ marginTop: 6 }}>Browse articles with this tag. Use filters to refine.</div>
        </div>
        <div className="chips" role="group" aria-label="Filters">
          <button className={`chip ${sort==='-created_at' && !period ? 'active' : ''}`} onClick={() => { setSort('-created_at'); setPeriod('') }}>Latest</button>
          <button className={`chip ${sort==='-like_count' && !period ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod('') }}>Trending</button>
          <button className={`chip ${period==='week' ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod('week') }}>This Week</button>
          <button className={`chip ${period==='month' ? 'active' : ''}`} onClick={() => { setSort('-like_count'); setPeriod('month') }}>This Month</button>
        </div>
      </div>

      {loading ? (
        <div className="grid">
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
          {items.length === 0 ? (
            <div className="section-card" style={{ textAlign:'center', padding:24 }}>
              <div className="muted">No articles found for <strong>#{tag}</strong>.</div>
            </div>
          ) : (
            <div className="grid">
              {items.map((a) => <ArticleCard article={a} key={a.id} />)}
            </div>
          )}
          <div ref={sentinelRef} style={{ display:'flex', justifyContent:'center', marginTop:16, paddingBottom:16 }}>
            <button className="btn" disabled={loadingMore || (pageInfo && page >= (pageInfo.totalPages || 1))} onClick={() => setPage(p => p + 1)}>
              {loadingMore ? 'Loading…' : (pageInfo && page >= (pageInfo.totalPages || 1)) ? 'No more results' : 'Load more'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
