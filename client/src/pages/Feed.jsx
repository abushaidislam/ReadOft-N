import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'
import Button from '../components/Button.jsx'

export default function Feed() {
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', sort: '-created_at' })
      const data = await request(`/feed?${params.toString()}`)
      setItems(data.items || [])
      setPageInfo(data.pageInfo || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(console.error) }, [page])

  return (
    <div className="container page">
      <h2>Your Feed</h2>
      {error && <p className="error">{error}</p>}
      {loading ? <p>Loading...</p> : (
        <>
          <div className="grid">
            {items.map((a) => <ArticleCard article={a} key={a.id} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <span className="muted">Page {pageInfo?.page || page} / {pageInfo?.totalPages || '?'}</span>
            <Button disabled={pageInfo && page >= pageInfo.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  )
}

