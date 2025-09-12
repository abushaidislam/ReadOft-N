import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function AdminLibrary() {
  const { request, ui, auth } = useAuth()
  const [bucket, setBucket] = useState('article-media') // article-media | thumbnails | videos
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest') // newest | oldest | name
  const uploadRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const endpointForBucket = (b) => {
    if (b === 'thumbnails') return '/uploads/thumbnails?limit=200'
    if (b === 'videos') return '/uploads/videos?limit=200'
    return '/uploads/article-media?limit=200'
  }

  const canUpload = bucket !== 'videos'

  const formatBytes = (n) => {
    const num = Number(n||0)
    if (!num) return '—'
    const units = ['B','KB','MB','GB']
    let i = 0; let v = num
    while (v >= 1024 && i < units.length-1) { v /= 1024; i++ }
    return `${v.toFixed(v<10 && i>0 ? 1 : 0)} ${units[i]}`
  }
  const formatDate = (d) => {
    try { return new Date(d || Date.now()).toLocaleString() } catch { return '' }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await request(endpointForBucket(bucket), { noGlobalLoading: true })
      setItems(Array.isArray(r?.items) ? r.items : [])
    } catch (e) { ui.notify(e?.message || 'Failed to load media', 'error'); setItems([]) } finally { setLoading(false) }
  }, [bucket, request, ui])

  useEffect(() => { load().catch(()=>{}) }, [load])

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    let arr = Array.isArray(items) ? [...items] : []
    if (query) arr = arr.filter((it) => (it.name || '').toLowerCase().includes(query))
    if (sort === 'name') arr.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    else {
      const key = 'updated_at'
      arr.sort((a,b)=>{
        const da = new Date(a[key] || a.created_at || 0).getTime()
        const db = new Date(b[key] || b.created_at || 0).getTime()
        return sort === 'newest' ? db - da : da - db
      })
    }
    return arr
  }, [items, q, sort])

  async function doDelete(it) {
    if (!confirm('Delete this file?')) return
    try {
      await request('/uploads/delete', { method:'POST', body: JSON.stringify({ bucket, path: it.path }), noGlobalLoading: true })
      setItems((arr)=>arr.filter((x)=>x.path!==it.path))
      ui.notify('Deleted', 'success')
    } catch (e) { ui.notify(e?.message || 'Delete failed', 'error') }
  }
  async function doRename(it) {
    const ext = (it.name.split('.').pop() || '').toLowerCase()
    const base = it.name.replace(/\.[^.]+$/, '')
    const input = prompt('New file name (without extension)', base)
    if (!input || input === base) return
    try {
      const newName = `${input}.${ext}`
      const r = await request('/uploads/rename', { method:'POST', body: JSON.stringify({ bucket, path: it.path, newName }), noGlobalLoading: true })
      setItems((arr)=>arr.map((x)=> x.path===it.path ? { ...x, name: newName, path: r.path||x.path, url: r.url||x.url } : x))
      ui.notify('Renamed', 'success')
    } catch (e) { ui.notify(e?.message || 'Rename failed','error') }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      if (bucket === 'thumbnails') {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/article-thumbnail`, { method:'POST', body: fd, headers: { ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) } })
        const up = await res.json(); if (!res.ok) throw new Error(up?.message || 'Upload failed')
      } else if (bucket === 'article-media') {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/article-media`, { method:'POST', body: fd, headers: { ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) } })
        const up = await res.json(); if (!res.ok) throw new Error(up?.message || 'Upload failed')
      } else {
        ui.notify('Video upload not enabled in this build', 'info')
      }
      await load()
      e.target.value = ''
    } catch (err) { ui.notify(err?.message || 'Upload failed', 'error') } finally { setUploading(false) }
  }

  return (
    <div className="container page">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav className="admin-nav" aria-label="Admin sections">
            <Link className="admin-link" to="/admin">Dashboard</Link>
            <Link className="admin-link" to="/admin/categories">Categories</Link>
            <Link className="admin-link active" to="/admin/library">Library</Link>
            <div className="muted" style={{ margin:'12px 4px 4px', fontSize:'.85rem' }}>Quick links</div>
            <Link className="admin-link" to="/editor">New Post</Link>
            <Link className="admin-link" to="/dashboard">Author Dashboard</Link>
            <Link className="admin-link" to="/profile">Profile</Link>
            <Link className="admin-link" to="/">Home</Link>
          </nav>
        </aside>
        <main className="admin-content">
          <div className="toolbar-sticky">
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 style={{ margin:0 }}>Media Library</h2>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select value={bucket} onChange={(e)=>setBucket(e.target.value)}>
                  <option value="article-media">Images (Inline)</option>
                  <option value="thumbnails">Thumbnails</option>
                  <option value="videos">Videos</option>
                </select>
                {canUpload && (
                  <>
                    <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onUpload} />
                    <button className={`btn ${uploading?'loading':''}`} disabled={uploading} onClick={()=>uploadRef.current?.click()}>{uploading?'Uploading…':'Upload'}</button>
                  </>
                )}
              </div>
            </div>
            <div className="page-head" style={{ marginTop: 0 }}>
              <input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} />
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label className="muted">Sort</label>
                <select value={sort} onChange={(e)=>setSort(e.target.value)}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="media-grid skeleton">
              {Array.from({ length: 12 }).map((_,i)=> (
                <div key={i} className="media-card"><div className="skeleton-thumb" style={{ height: 160 }} /></div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="muted" style={{ padding:'24px 0' }}>No media found.</div>
          ) : (
            <div className="media-grid">
              {list.map((it) => (
                <div key={it.path} className="media-card">
                  {bucket === 'videos' ? (
                    <video src={it.url} controls style={{ width:'100%', height:160, objectFit:'cover' }} />
                  ) : (
                    <img src={it.url} alt={it.name} style={{ height:160 }} loading="lazy" decoding="async" />
                  )}
                  <div className="media-actions">
                    <button className="icon-btn" title="Rename" onClick={()=>doRename(it)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21.41 6.34a1.25 1.25 0 000-1.77l-2.99-2.99a1.25 1.25 0 00-1.77 0l-1.83 1.83 3.75 3.75 1.84-1.82z"></path></svg>
                    </button>
                    <button className="icon-btn" title="Delete" onClick={()=>doDelete(it)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                    </button>
                  </div>
                  <div className="media-meta">
                    <div className="name" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.name}</div>
                    <div className="sub" style={{ fontSize: '.8rem', opacity:.85 }}>{formatBytes(it.size)} • {formatDate(it.updated_at || it.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
