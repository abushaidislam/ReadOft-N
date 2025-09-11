import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Dashboard() {
  const { request, auth } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('all') // all | draft | pending | published

  const load = async () => {
    setLoading(true)
    try {
      const data = await request(`/articles?author_id=${auth.user.id}`, { noGlobalLoading: true })
      setItems(data.items)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(console.error) }, [])

  const DashboardSkeleton = () => (
    <div className="skeleton">
      <table className="table">
        <thead>
          <tr><th>Title</th><th>Status</th><th>Likes</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td><div className="skeleton-line w-80" /></td>
              <td><span className="skeleton-chip" /></td>
              <td><div className="skeleton-line w-40" /></td>
              <td><div className="skeleton-line w-50" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="container page">
      <div className="page-head">
        <h2>Your Articles</h2>
        <Link className="btn btn-primary" to="/editor">New Article</Link>
      </div>
      <div className="tabs" role="tablist" aria-label="Article status tabs" style={{ marginTop: 8 }}>
        {['all','draft','pending','published'].map((s) => (
          <button key={s} className={`tab ${tab===s?'active':''}`} role="tab" aria-selected={tab===s} onClick={()=>setTab(s)}>
            {s[0].toUpperCase()+s.slice(1)}{s!=='all' ? ` (${items.filter(i=>i.status===s).length})` : ''}
          </button>
        ))}
      </div>
      {error && <p>{error}</p>}
      {loading ? <DashboardSkeleton /> : (
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Status</th><th>Likes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.filter(a => tab==='all' ? true : a.status===tab).map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td><span className={`badge ${a.status}`}>{a.status==='pending'?'in review':a.status}</span></td>
                <td>{a.like_count}</td>
                <td>
                  <Link className="btn" to={`/editor/${a.id}`}>Edit</Link>
                  {a.status==='draft' && (
                    <button className="btn btn-primary" style={{marginLeft:8}} onClick={async () => {
                      await request(`/articles/${a.id}`, { method: 'PUT', body: JSON.stringify({ status: 'pending' }), noGlobalLoading: true })
                      await load()
                    }}>Submit for review</button>
                  )}
                  <button className="btn" style={{marginLeft:8}} onClick={async () => {
                    if (!confirm('Delete this article? This cannot be undone.')) return
                    await request(`/articles/${a.id}`, { method: 'DELETE', noGlobalLoading: true })
                    load()
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
