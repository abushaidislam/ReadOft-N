import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Author() {
  const { id } = useParams()
  const { request, auth } = useAuth()
  const [summary, setSummary] = useState(null)
  const [articles, setArticles] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followed, setFollowed] = useState(false)
  const [sort, setSort] = useState('-created_at') // '-created_at' | '-like_count'

  const loadSummary = async () => {
    const s = await request(`/authors/${id}/summary`)
    setSummary(s)
  }

  const loadArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ author_id: id, page: String(page), limit: '12', sort })
      const data = await request(`/articles?${params.toString()}`)
      setArticles(data.items || [])
      setPageInfo(data.pageInfo || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const checkFollow = async () => {
    try {
      const list = await request('/follows/me')
      setFollowed((list || []).some((u) => u.id === id))
    } catch (e) { if (import.meta.env.DEV) console.debug('checkFollow failed', e) }
  }

  const follow = async () => {
    try { await request(`/follows/${id}`, { method: 'POST' }); setFollowed(true); loadSummary() } catch (e) { if (import.meta.env.DEV) console.debug('follow failed', e) }
  }
  const unfollow = async () => {
    try { await request(`/follows/${id}`, { method: 'DELETE' }); setFollowed(false); loadSummary() } catch (e) { if (import.meta.env.DEV) console.debug('unfollow failed', e) }
  }

  useEffect(() => { setPage(1); loadSummary().catch(()=>{}); checkFollow().catch(()=>{}); }, [id])
  useEffect(() => { loadArticles().catch(()=>{}) }, [page, sort, id])

  if (error) return <div className="container page"><p className="error">{error}</p></div>

  return (
    <div className="container page">
      {/* Profile header */}
      <div className="section-card" style={{ display:'flex', gap:16, alignItems:'center', padding:16, marginBottom:16 }}>
        <img
          src={summary?.user?.avatar_url || 'https://placehold.co/160x160?text=A'}
          alt="author avatar"
          width={120}
          height={120}
          style={{ borderRadius:'50%', border:'1px solid var(--border)', objectFit:'cover' }}
          loading="lazy"
          decoding="async"
        />
        <div style={{ flex:1 }}>
          <div className="page-head" style={{ marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <h2 style={{ margin: 0 }}>{summary?.user?.name || 'Author'}</h2>
              {summary?.user?.headline && <div className="muted" style={{ marginTop:4 }}>{summary.user.headline}</div>}
            </div>
            <div>
              {auth.user && auth.user.id !== id && (
                followed ? (
                  <button className="btn" onClick={unfollow}>Unfollow</button>
                ) : (
                  <button className="btn btn-primary" onClick={follow}>Follow</button>
                )
              )}
            </div>
          </div>
          <p className="muted" style={{ margin:'6px 0 10px' }}>{summary?.user?.bio || '—'}</p>
          {/* Stats */}
          <div style={{ display:'flex', gap:18, flexWrap:'wrap' }}>
            <div className="stat"><div className="value">{(summary?.counts?.followers ?? 0).toLocaleString?.() || (summary?.counts?.followers ?? 0)}</div><div className="label">Followers</div></div>
            <div className="stat"><div className="value">{(summary?.counts?.posts ?? 0).toLocaleString?.() || (summary?.counts?.posts ?? 0)}</div><div className="label">Articles</div></div>
            <div className="stat"><div className="value">{(summary?.counts?.likes ?? 0).toLocaleString?.() || (summary?.counts?.likes ?? 0)}</div><div className="label">Likes</div></div>
          </div>
        </div>
      </div>

      {/* Articles section */}
      <div className="section-card" style={{ padding:16 }}>
        <div className="page-head" style={{ marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <h3 style={{ margin:0 }}>Articles</h3>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="muted">Sort</span>
            <select className="btn" value={sort} onChange={(e)=>{ setPage(1); setSort(e.target.value) }} style={{ padding:'6px 8px' }}>
              <option value='-created_at'>Latest</option>
              <option value='-like_count'>Most Liked</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="card skeleton" key={i}>
                <div className="skeleton-thumb" />
                <div className="skeleton-line w-80" />
                <div className="skeleton-line w-60" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid">
              {articles.map((a) => <ArticleCard article={a} key={a.id} />)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span className="muted">Page {pageInfo?.page || page} / {pageInfo?.totalPages || '?'}</span>
              <button className="btn" disabled={pageInfo && page >= pageInfo.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

