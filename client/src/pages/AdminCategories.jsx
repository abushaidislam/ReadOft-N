import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function AdminCategories() {
  const { request, ui } = useAuth()
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try { setCategories(await request('/categories')) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load().catch(() => { /* ignore */ }) }, [])

  const add = async () => {
    if (!name.trim()) return
    try {
      await request('/categories', { method: 'POST', body: JSON.stringify({ name, slug: slug || undefined }) })
      ui.notify('Category created', 'success')
      setName(''); setSlug(''); load()
    } catch {}
  }
  const update = async (id, patch) => {
    try { await request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(patch) }); ui.notify('Category updated', 'success'); load() } catch {}
  }
  const remove = async (id) => {
    if (!confirm('Delete this category?')) return
    try { await request(`/categories/${id}`, { method: 'DELETE' }); ui.notify('Category deleted', 'success'); load() } catch {}
  }

  return (
    <div className="container page">
      <div className="page-head">
        <h2>Manage Categories</h2>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="section-card">
        <h3 style={{marginTop:0}}>Create new</h3>
        <div className="form">
          <input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
          <input placeholder="Slug (optional)" value={slug} onChange={(e)=>setSlug(e.target.value)} />
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <Button variant="primary" onClick={add}>Create</Button>
          </div>
        </div>
      </section>
      <section className="section-card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>All categories</h3>
        {loading ? <p>Loading…</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.slug}</td>
                  <td>
                    <Button onClick={() => {
                      const v = prompt('Rename category', c.name)
                      if (v && v !== c.name) update(c.id, { name: v })
                    }}>Rename</Button>
                    <Button onClick={() => {
                      const v = prompt('Update slug', c.slug)
                      if (v && v !== c.slug) update(c.id, { slug: v })
                    }}>Slug</Button>
                    <Button onClick={() => remove(c.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

