import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function Dashboard() {
  const { request, auth } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // all | draft | pending | published

  const load = async () => {
    setLoading(true)
    const data = await request(`/articles?author_id=${auth.user.id}`)
    setItems(data.items)
    setLoading(false)
  }

  useEffect(() => { load().catch(console.error) }, [])

  return (
    <div className="container page">
      <div className="page-head">
        <h2>Your Articles</h2>
        <Button as={Link} variant="primary" to="/editor">New Article</Button>
      </div>
      <div className="tabs" role="tablist" aria-label="Article status tabs" style={{ marginTop: 8 }}>
        {['all','draft','pending','published'].map((s) => (
          <button key={s} className={`tab ${tab===s?'active':''}`} role="tab" aria-selected={tab===s} onClick={()=>setTab(s)}>
            {s[0].toUpperCase()+s.slice(1)}{s!=='all' ? ` (${items.filter(i=>i.status===s).length})` : ''}
          </button>
        ))}
      </div>
      {loading ? <p>Loading...</p> : (
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
                  <Button as={Link} to={`/editor/${a.id}`}>Edit</Button>
                  {a.status==='draft' && (
                    <Button variant="primary" style={{marginLeft:8}} onClick={async () => {
                      await request(`/articles/${a.id}`, { method: 'PUT', body: JSON.stringify({ status: 'pending' }) })
                      await load()
                    }}>Submit for review</Button>
                  )}
                  <Button style={{marginLeft:8}} onClick={async () => {
                    if (!confirm('Delete this article? This cannot be undone.')) return
                    await request(`/articles/${a.id}`, { method: 'DELETE' })
                    load()
                  }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
