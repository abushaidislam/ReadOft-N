import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { Image as ImageIcon, Film, Upload as UploadIcon, Pencil, Trash2, ExternalLink, Copy } from 'lucide-react'

export default function AdminLibrary() {
  const { request, ui, auth } = useAuth()
  const [bucket, setBucket] = useState('article-media') // article-media | thumbnails | videos
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest') // newest | oldest | name
  const uploadRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState([]) // array of paths
  const [preview, setPreview] = useState(null) // item
  const [dropOpen, setDropOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const dropInputRef = useRef(null)
  const notifyRef = useRef(ui.notify)
  useEffect(() => { notifyRef.current = ui.notify }, [ui.notify])

  const endpointForBucket = (b) => {
    if (b === 'thumbnails') return '/uploads/thumbnails?limit=200'
    if (b === 'videos') return '/uploads/videos?limit=200'
    return '/uploads/article-media?limit=200'
  }

  async function uploadFiles(files) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await uploadFile(file)
    }
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
    } catch (e) {
      try { notifyRef.current?.(e?.message || 'Failed to load media', 'error') } catch (err) {
        if (import.meta.env.DEV) console.debug('notify failed', err)
      }
      setItems([])
    } finally { setLoading(false) }
  }, [bucket, request])

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

  async function uploadFile(file) {
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
    } catch (err) { ui.notify(err?.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  // Removed page-level DnD; using modal drop dialog instead

  // Modal drop handlers
  const onModalDragOver = (e) => { if (!canUpload) return; e.preventDefault(); e.stopPropagation(); setDropActive(true) }
  const onModalDragEnter = (e) => { if (!canUpload) return; e.preventDefault(); e.stopPropagation(); setDropActive(true) }
  const onModalDragLeave = (e) => { if (!canUpload) return; e.preventDefault(); e.stopPropagation(); setDropActive(false) }
  const onModalDrop = async (e) => {
    if (!canUpload) return
    e.preventDefault(); e.stopPropagation(); setDropActive(false)
    const files = e.dataTransfer?.files
    if (files && files.length) {
      await uploadFiles(files)
      setDropOpen(false)
    }
  }

  const isSelected = (path) => selected.includes(path)
  const toggleSelect = (path) => setSelected((arr)=> arr.includes(path) ? arr.filter((p)=>p!==path) : [...arr, path])
  const clearSelection = () => setSelected([])
  const copySelectedUrls = async () => {
    const urls = items.filter(it=> selected.includes(it.path)).map(it=> it.url).join('\n')
    try { await navigator.clipboard.writeText(urls); ui.notify('Copied URLs', 'success') } catch { ui.notify('Copy failed', 'error') }
  }
  const bulkDelete = async () => {
    if (selected.length === 0) return
    if (!confirm(`Delete ${selected.length} item(s)?`)) return
    try {
      await Promise.all(selected.map((path)=> request('/uploads/delete', { method:'POST', body: JSON.stringify({ bucket, path }), noGlobalLoading: true })))
      setItems((arr)=> arr.filter((it)=> !selected.includes(it.path)))
      clearSelection()
      ui.notify('Deleted', 'success')
    } catch (e) { ui.notify(e?.message || 'Delete failed', 'error') }
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
            <div className="lib-toolbar">
              <div className="chips" role="tablist" aria-label="Buckets">
                <button className="chip" role="tab" aria-selected={bucket==='article-media'} onClick={()=>setBucket('article-media')}>
                  <ImageIcon size={16} /> <span>Images</span>
                </button>
                <button className="chip" role="tab" aria-selected={bucket==='thumbnails'} onClick={()=>setBucket('thumbnails')}>
                  <ImageIcon size={16} /> <span>Thumbs</span>
                </button>
                <button className="chip" role="tab" aria-selected={bucket==='videos'} onClick={()=>setBucket('videos')}>
                  <Film size={16} /> <span>Videos</span>
                </button>
              </div>
              <div className="lib-spacer" />
              <input className="lib-search" placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} />
              <select aria-label="Sort" value={sort} onChange={(e)=>setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
              {canUpload && (
                <>
                  <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onUpload} />
                  <button className={`btn ${uploading?'loading':''}`} title="Upload" disabled={uploading} onClick={()=>uploadRef.current?.click()}><UploadIcon size={16} /></button>
                  <button className="btn" title="Open Drop Dialog" disabled={!canUpload} onClick={()=>setDropOpen(true)}><UploadIcon size={16} /></button>
                </>
              )}
            </div>
            <div className="card-actions" style={{ justifyContent:'flex-end', alignItems:'center' }}>
              {selected.length>0 && (
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn" onClick={copySelectedUrls}>Copy URLs</button>
                  <button className="btn" onClick={bulkDelete}>Delete Selected</button>
                  <button className="btn" onClick={clearSelection}>Clear</button>
                </div>
              )}
            </div>
          </div>
          {loading ? (
            <div className="media-grid skeleton">
              {Array.from({ length: 12 }).map((_,i)=> (
                <div key={i} className="media-card">
                  <div className="media-thumb">
                    <div className="skeleton-thumb" style={{ height: '100%' }} />
                    <div className="media-caption">
                      <span className="skeleton-line w-60" style={{ height: 10 }} />
                      <span className="skeleton-line w-40" style={{ height: 10 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="muted" style={{ padding:'24px 0' }}>No media found.</div>
          ) : (
            <div className="media-grid">
              {list.map((it) => (
                <div key={it.path} className={`media-card ${isSelected(it.path)?'selected':''}`} onClick={() => toggleSelect(it.path)} onDoubleClick={() => setPreview(it)} title={it.name}>
                  <div className="media-thumb">
                    {bucket === 'videos' ? (
                      <video src={it.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={it.url} alt={it.name} loading="lazy" decoding="async" />
                    )}
                    <div className="media-caption">
                      <span className="name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name}</span>
                      <span className="size">{formatBytes(it.size)}</span>
                    </div>
                    <div className="media-actions">
                      <button className="icon-btn" title="Open" onClick={(e)=>{ e.stopPropagation(); window.open(it.url, '_blank', 'noopener,noreferrer') }}><ExternalLink size={16} /></button>
                      <button className="icon-btn" title="Copy URL" onClick={async (e)=>{ e.stopPropagation(); try { await navigator.clipboard.writeText(it.url); ui.notify('Copied link','success') } catch { ui.notify('Copy failed','error') } }}><Copy size={16} /></button>
                      <button className="icon-btn" title="Rename" onClick={(e)=>{ e.stopPropagation(); doRename(it) }}><Pencil size={16} /></button>
                      <button className="icon-btn" title="Delete" onClick={(e)=>{ e.stopPropagation(); doDelete(it) }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {preview && (
            <div className="modal-overlay" onClick={()=>setPreview(null)} role="dialog" aria-modal="true">
              <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
                <div className="page-head" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>{preview.name}</h3>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn" onClick={async()=>{ try { await navigator.clipboard.writeText(preview.url); ui.notify('Copied link','success') } catch { ui.notify('Copy failed','error') } }}>Copy URL</button>
                    <a className="btn" href={preview.url} target="_blank" rel="noreferrer">Open</a>
                    <button className="btn" onClick={()=>{ doRename(preview); setPreview(null) }}>Rename</button>
                    <button className="btn" onClick={()=>{ doDelete(preview); setPreview(null) }}>Delete</button>
                    <button className="btn" onClick={()=>setPreview(null)}>Close</button>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  {bucket === 'videos' ? (
                    <video src={preview.url} controls style={{ width:'100%', maxHeight: '60vh' }} />
                  ) : (
                    <img src={preview.url} alt={preview.name} style={{ width:'100%', maxHeight:'60vh', objectFit:'contain' }} />
                  )}
                </div>
                <div className="muted" style={{ fontSize: '.9rem' }}>{formatBytes(preview.size)} • {formatDate(preview.updated_at || preview.created_at)}</div>
              </div>
            </div>
          )}
          {dropOpen && (
            <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setDropOpen(false)}>
              <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e)=>e.stopPropagation()}>
                <div className="page-head" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin:0 }}>Drop to upload</h3>
                  <button className="btn" onClick={()=>setDropOpen(false)}>Close</button>
                </div>
                <div
                  className={`dropzone ${dropActive ? 'active': ''}`}
                  style={{ height: 260, display:'grid', placeItems:'center', textAlign:'center' }}
                  onDragOver={onModalDragOver}
                  onDragEnter={onModalDragEnter}
                  onDragLeave={onModalDragLeave}
                  onDrop={onModalDrop}
                >
                  <div>
                    <UploadIcon size={20} />
                    <div style={{ marginTop: 6 }}>Drag & drop image here</div>
                    <div className="muted" style={{ fontSize: '.9rem', marginTop: 4 }}>or</div>
                    <input ref={dropInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={async (e)=>{ const files = e.target.files; if (files && files.length) { await uploadFiles(files); setDropOpen(false); e.target.value=''} }} />
                    <button className="btn" style={{ marginTop: 8 }} onClick={()=>dropInputRef.current?.click()}>Browse files</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
