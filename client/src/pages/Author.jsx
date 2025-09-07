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

  const loadSummary = async () => {
    const s = await request(`/authors/${id}/summary`)
    setSummary(s)
  }

  const loadArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ author_id: id, page: String(page), limit: '12', sort: '-created_at' })
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
    } catch {}
  }

  const follow = async () => {
    try { await request(`/follows/${id}`, { method: 'POST' }); setFollowed(true); loadSummary() } catch {}
  }
  const unfollow = async () => {
    try { await request(`/follows/${id}`, { method: 'DELETE' }); setFollowed(false); loadSummary() } catch {}
  }

  useEffect(() => { setPage(1); loadSummary().catch(()=>{}); loadArticles().catch(()=>{}); checkFollow().catch(()=>{}) }, [id])
  useEffect(() => { loadArticles().catch(()=>{}) }, [page])

  if (error) return <div className="container page"><p className="error">{error}</p></div>

  return (
    <div className="container page">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <img src={summary?.user?.avatar_url || 'https://placehold.co/80x80?text=A'} width={72} height={72} style={{ borderRadius: '50%', border: '1px solid var(--border)' }} />
        <div>
          <h2 style={{ margin: 0 }}>{summary?.user?.name || 'Author'}</h2>
          <p className="muted" style={{ margin: 0 }}>{summary?.user?.bio}</p>
          <div className="chips" style={{ marginTop: 8 }}>
            <span className="chip">Posts: {summary?.counts?.posts ?? '-'}</span>
            <span className="chip">Likes: {summary?.counts?.likes ?? '-'}</span>
            <span className="chip">Followers: {summary?.counts?.followers ?? '-'}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {auth.user && auth.user.id !== id && (
            followed ? (
              <button className="btn" onClick={unfollow}>Unfollow</button>
            ) : (
              <button className="btn btn-primary" onClick={follow}>Follow</button>
            )
          )}
        </div>
      </div>

      <h3>Articles</h3>
      {loading ? <p>Loading...</p> : (
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
  )
}

