import { useEffect, useState } from 'react'
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

  const fetchData = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    if (category) params.set('category', category)
    params.set('page', String(page))
    params.set('limit', '12')
    params.set('sort', '-created_at')
    const data = await request(`/articles?${params.toString()}`)
    setItems(data.items)
    setPageInfo(data.pageInfo || null)
    setLoading(false)
  }

  useEffect(() => { fetchData().catch(console.error) }, [page])
  useEffect(() => { request('/categories').then(setCategories).catch(() => {}) }, [])

  return (
    <div className="container page">
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
      {loading ? <p>Loading...</p> : (
        <>
          <div className="grid">
            {items.map((a) => <ArticleCard article={a} key={a.id} />)}
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
  )}
