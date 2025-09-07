import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export default function Editor() {
  const { request, auth } = useAuth()
  const { id } = useParams()
  const nav = useNavigate()
  const [form, setForm] = useState({ title: '', content: '', tags: '', categories: [], status: 'pending', thumbnail_url: '', thumbnail_path: '' })
  const [error, setError] = useState('')
  const [allCategories, setAllCategories] = useState([])
  const [thumbFile, setThumbFile] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!id) return
    request(`/articles/${id}`).then((a) => setForm({
      title: a.title,
      content: a.content,
      tags: (a.tags || []).join(', '),
      categories: a.categories || [],
      status: a.status,
      thumbnail_url: a.thumbnail_url || '',
      thumbnail_path: a.thumbnail_path || '',
    })).catch(console.error)
  }, [id])

  useEffect(() => { request('/categories').then(setAllCategories).catch(() => {}) }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      let thumbnail_url = form.thumbnail_url || ''
      let thumbnail_path = form.thumbnail_path || ''
      if (thumbFile) {
        const fd = new FormData()
        fd.append('file', thumbFile)
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/article-thumbnail`, {
          method: 'POST',
          headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
          body: fd,
        })
        if (!res.ok) {
          let msg = 'Thumbnail upload failed'
          try { const j = await res.json(); if (j?.message) msg = j.message } catch {}
          throw new Error(msg)
        }
        const up = await res.json()
        thumbnail_url = up.url
        thumbnail_path = up.path || ''
      }
      const payload = {
        title: form.title,
        content: form.content,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        categories: form.categories,
        thumbnail_url,
        thumbnail_path,
        status: form.status,
      }
      if (id) await request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await request('/articles', { method: 'POST', body: JSON.stringify(payload) })
      nav('/dashboard')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container page narrow">
      <h2>{id ? 'Edit Article' : 'New Article'}</h2>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div>
          <label>Thumbnail image</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} />
          {(thumbFile || form.thumbnail_url) && (
            <div style={{ marginTop: 8 }}>
              <img alt="thumbnail" src={thumbFile ? URL.createObjectURL(thumbFile) : form.thumbnail_url} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          )}
        </div>
        <textarea placeholder="Content" rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <label>Categories:</label>
        <div className="chips">
          {allCategories.map((c) => {
            const checked = form.categories.includes(c.slug)
            return (
              <label key={c.id} className="chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={(e) => {
                  const next = new Set(form.categories)
                  if (e.target.checked) next.add(c.slug); else next.delete(c.slug)
                  setForm({ ...form, categories: Array.from(next) })
                }} />
                <span style={{ marginLeft: 6 }}>{c.name}</span>
              </label>
            )
          })}
        </div>
        <label>
          Status:
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="published">Published</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit">Save</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title">Preview</h3>
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {form.content || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
