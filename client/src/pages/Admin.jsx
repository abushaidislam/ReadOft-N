import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function Admin() {
  const { request, ui } = useAuth()
  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [categories, setCategories] = useState([])
  const [catName, setCatName] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [u, p, c] = await Promise.all([
        request('/admin/users'),
        request('/admin/articles/pending'),
        request('/categories'),
      ])
      setUsers(u)
      setPending(p)
      setCategories(c)
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

  return (
    <div className="container page">
      <h2>Admin Panel</h2>
      {error && <p className="error">{error}</p>}
    <div className="grid two">
      <section>
        <h3>Users</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                      <option value="reader">reader</option>
                      <option value="author">author</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>
      <section>
          <h3>Pending Articles</h3>
          <table className="table">
            <thead><tr><th>Title</th><th>Author</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.author_id}</td>
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
      <section>
        <h3>Categories</h3>
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
    </div>
    </div>
  )
}
