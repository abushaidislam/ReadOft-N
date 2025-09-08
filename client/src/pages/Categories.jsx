import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Categories() {
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const cats = await request('/categories')
        // Fetch counts per category using the articles endpoint's count
        const withCounts = await Promise.all(
          (cats || []).map(async (c) => {
            try {
              const r = await request(`/articles?category=${encodeURIComponent(c.slug)}&limit=1`, { noGlobalLoading: true })
              return { ...c, postCount: r?.pageInfo?.total ?? 0 }
            } catch {
              return { ...c, postCount: 0 }
            }
          })
        )
        setItems(withCounts)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="container page">
      <h2>Categories</h2>
      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card skeleton">
              <div className="skeleton-line w-80" />
              <div className="skeleton-line w-60" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          {items.map((c) => (
            <Link className="card" key={c.id} to={`/category/${c.slug}`}>
              <h3 className="card-title">{c.name}</h3>
              <p className="muted">/{c.slug} • {typeof c.postCount === 'number' ? c.postCount : 0} {c.postCount === 1 ? 'post' : 'posts'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
