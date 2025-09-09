import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'

export default function Admin() {
  const { request, ui } = useAuth()
  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [categories, setCategories] = useState([])
  const [apps, setApps] = useState([])
  const [reports, setReports] = useState([])
  const [catName, setCatName] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('dashboard')

  const load = async () => {
    try {
      const [u, p, c, a, r] = await Promise.all([
        request('/admin/users'),
        request('/admin/articles/pending'),
        request('/categories'),
        request('/admin/author-requests'),
        request('/admin/reports'),
      ])
      setUsers(u)
      setPending(p)
      setCategories(c)
      setApps(a)
      setReports(r)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load().catch(console.error) }, [])

  const setRole = async (id, role) => {
    await request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
    ui.notify('Role updated', 'success')
    load()
  }

  const approve = async (id) => {
    await request(`/articles/${id}/approve`, { method: 'POST' })
    ui.notify('Article approved', 'success')
    load()
  }

  const reject = async (id) => {
    const reason = prompt('Reason for rejection? (optional)') || ''
    await request(`/articles/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
    ui.notify('Article rejected', 'info')
    load()
  }

  const deleteArticle = async (id) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await request(`/articles/${id}`, { method: 'DELETE' })
    ui.notify('Article deleted', 'success')
    load()
  }

  const addCategory = async () => {
    if (!catName.trim()) return
    await request('/categories', { method: 'POST', body: JSON.stringify({ name: catName, slug: catSlug || undefined }) })
    ui.notify('Category added', 'success')
    setCatName(''); setCatSlug(''); load()
  }
  const updateCategory = async (id, patch) => {
    await request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
    ui.notify('Category updated', 'success')
    load()
  }
  const deleteCategory = async (id) => {
    await request(`/categories/${id}`, { method: 'DELETE' })
    ui.notify('Category deleted', 'success')
    load()
  }

  const updateReport = async (id, patch) => {
    await request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
    ui.notify('Report updated', 'success')
    load()
  }

  const DashboardView = () => (
    <div className="grid two">
      <section className="section-card">
        <h3 style={{marginTop:0}}>Overview</h3>
        <div className="stat-grid">
          <div className="stat"><div className="value">{users.length}</div><div className="label">Users</div></div>
          <div className="stat"><div className="value">{pending.length}</div><div className="label">Pending</div></div>
          <div className="stat"><div className="value">{categories.length}</div><div className="label">Categories</div></div>
          <div className="stat"><div className="value">—</div><div className="label">Reports</div></div>
        </div>
      </section>
      <section className="section-card">
        <h3 style={{marginTop:0}}>Quick actions</h3>
        <div className="chips">
          <button className="chip" onClick={()=>setTab('users')}>Manage users</button>
          <button className="chip" onClick={()=>setTab('pending')}>Review pending</button>
          <button className="chip" onClick={()=>setTab('categories')}>Edit categories</button>
        </div>
      </section>
    </div>
  )

  const UsersView = () => (
      <section className="section-card">
        <h3>Users</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.is_banned ? <span className="badge pending">banned</span> : <span className="badge published">active</span>}</td>
                  <td style={{display:'flex', gap:8}}>
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                      <option value="reader">reader</option>
                      <option value="author">author</option>
                      <option value="admin">admin</option>
                    </select>
                    <button className="btn" onClick={async()=>{ await request(`/admin/users/${u.id}/ban`, { method:'PUT', body: JSON.stringify({ banned: !u.is_banned }) }); load() }}>{u.is_banned?'Unban':'Ban'}</button>
                    <button className="btn" onClick={async()=>{ if (confirm('Delete user account? This cannot be undone.')) { await request(`/admin/users/${u.id}`, { method:'DELETE' }); load() } }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>
  )

  const PendingView = () => (
      <section className="section-card">
          <h3>Pending Articles</h3>
          <table className="table">
            <thead><tr><th>Title</th><th>Author</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>
                    <Link to={`/author/${a.author?.id || a.author_id}`} className="chip author-chip">
                      {a.author?.avatar_url ? (
                        <img className="avatar" src={a.author.avatar_url} alt={a.author?.name || 'Author'} />
                      ) : (
                        <span className="avatar avatar-fallback">{(a.author?.name || 'A').slice(0,1).toUpperCase()}</span>
                      )}
                      <span className="author-name">{a.author?.name || a.author_id}</span>
                    </Link>
                  </td>
                  <td style={{display:'flex', gap:8}}>
                    <button className="btn btn-primary" onClick={() => approve(a.id)}>Approve</button>
                    <button className="btn" onClick={() => reject(a.id)}>Reject</button>
                    <button className="btn" onClick={() => deleteArticle(a.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
  )

  const CategoriesView = () => (
      <section className="section-card">
        <h3>Categories</h3>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <Link className="btn" to="/admin/categories">Open full page</Link>
        </div>
        <div className="form" style={{marginBottom:12}}>
          <input placeholder="Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <input placeholder="Slug (optional)" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} />
          <button className="btn btn-primary" onClick={addCategory}>Add</button>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>
                  <button className="btn" onClick={() => {
                    const name = prompt('Rename category', c.name)
                    if (name && name !== c.name) updateCategory(c.id, { name })
                  }}>Rename</button>
                  <button className="btn" onClick={() => {
                    const slug = prompt('Update slug', c.slug)
                    if (slug && slug !== c.slug) updateCategory(c.id, { slug })
                  }}>Slug</button>
                  <button className="btn" onClick={() => { if (confirm('Delete category?')) deleteCategory(c.id) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
  )

  const ApplicationsView = () => (
    <section className="section-card">
      <h3 style={{marginTop:0}}>Author Applications</h3>
      <table className="table">
        <thead><tr><th>User</th><th>Email</th><th>Requested</th><th>Actions</th></tr></thead>
        <tbody>
          {(apps||[]).map((r) => (
            <tr key={r.id}>
              <td>{r.payload?.name || r.payload?.user_id || 'User'}</td>
              <td>{r.payload?.email || '-'}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td style={{display:'flex', gap:8}}>
                <button className="btn btn-primary" onClick={async()=>{ await request(`/admin/author-requests/${r.id}/approve`, { method:'POST' }); load() }}>Approve</button>
                <button className="btn" onClick={async()=>{ const reason = prompt('Reason? (optional)')||''; await request(`/admin/author-requests/${r.id}/reject`, { method:'POST', body: JSON.stringify({ reason }) }); load() }}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )

  const ReportsView = () => (
    <section className="section-card">
      <h3 style={{marginTop:0}}>Reports</h3>
      <div className="muted" style={{marginBottom:8}}>Open: {reports.filter(r=>r.status==='open').length} • Total: {reports.length}</div>
      <table className="table">
        <thead>
          <tr><th>Created</th><th>Target</th><th>Reporter</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>
                <span className="chip">{r.target_type}</span>
                {r.target_type==='post' && <a className="btn btn-link" href={`/article/${r.target_id}`} target="_blank" rel="noreferrer">Open</a>}
              </td>
              <td>{r.reporter?.name || r.reporter_id}</td>
              <td style={{maxWidth:420, whiteSpace:'pre-wrap'}}>{r.reason}</td>
              <td>{r.status}</td>
              <td style={{display:'flex', gap:8}}>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'reviewed' })}>Review</button>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'dismissed' })}>Dismiss</button>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'actioned' })}>Actioned</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )

  return (
    <div className="container page">
      <h2>Admin Panel</h2>
      {error && <p className="error">{error}</p>}
      <div className="admin-layout">
        <aside className="admin-sidebar">
        <nav className="admin-nav" aria-label="Admin sections">
            <button className={`admin-link ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
            <button className={`admin-link ${tab==='analytics'?'active':''}`} onClick={()=>setTab('analytics')}>Analytics</button>
            <button className={`admin-link ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}>Users</button>
            <button className={`admin-link ${tab==='pending'?'active':''}`} onClick={()=>setTab('pending')}>Pending Posts {pending.length?`(${pending.length})`:''}</button>
            <button className={`admin-link ${tab==='categories'?'active':''}`} onClick={()=>setTab('categories')}>Categories</button>
          <button className={`admin-link ${tab==='applications'?'active':''}`} onClick={()=>setTab('applications')}>Applications {apps.length?`(${apps.length})`:''}</button>
          <button className={`admin-link ${tab==='reports'?'active':''}`} onClick={()=>setTab('reports')}>Reports {reports.filter(r=>r.status==='open').length?`(${reports.filter(r=>r.status==='open').length})`:''}</button>
            <div className="muted" style={{ margin:'12px 4px 4px', fontSize:'.85rem' }}>Quick links</div>
            <Link className="admin-link" to="/editor">New Post</Link>
            <Link className="admin-link" to="/dashboard">Author Dashboard</Link>
            <Link className="admin-link" to="/profile">Profile</Link>
            <Link className="admin-link" to="/">Home</Link>
          </nav>
        </aside>
        <main className="admin-content">
          {tab==='dashboard' && <DashboardView />}
          {tab==='analytics' && <AdminAnalytics />}
          {tab==='users' && <UsersView />}
          {tab==='pending' && <PendingView />}
          {tab==='categories' && <CategoriesView />}
          {tab==='applications' && <ApplicationsView />}
          {tab==='reports' && <ReportsView />}
        </main>
      </div>
    </div>
  )
}
