import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export default function Editor() {
  const { request, auth, ui } = useAuth()
  const { id } = useParams()
  const nav = useNavigate()
  const [form, setForm] = useState({ title: '', content: '', tags: '', categories: [], status: 'pending', thumbnail_url: '', thumbnail_path: '' })
  const [error, setError] = useState('')
  const [allCategories, setAllCategories] = useState([])
  const [thumbFile, setThumbFile] = useState(null)
  const fileRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [savingNote, setSavingNote] = useState('')
  const [articleId, setArticleId] = useState(id || '')
  const [revisions, setRevisions] = useState([])
  const editorRef = useRef(null)

  function slugify(input) {
    return String(input || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
  }

  useEffect(() => {
    if (!id) return
    request(`/articles/${id}`).then((a) => { setForm({
      title: a.title,
      content: a.content,
      tags: (a.tags || []).join(', '),
      categories: a.categories || [],
      status: a.status,
      thumbnail_url: a.thumbnail_url || '',
      thumbnail_path: a.thumbnail_path || '',
    }); setSlug(a.slug || slugify(a.title)) }).catch(console.error)
  }, [id])

  useEffect(() => { request('/categories').then(setAllCategories).catch(() => {}) }, [])
  // auto-generate slug when title changes unless user edited slug
  useEffect(() => { if (!slugTouched) setSlug(slugify(form.title)) }, [form.title])

  // load revisions when article id available
  useEffect(() => { if (articleId) request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch(()=>{}) }, [articleId])

  // autosave draft every 10s when editing
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        if (!form.title && !form.content) return
        const payload = {
          title: form.title || '(untitled)',
          content: form.content || '',
          tags: form.tags.split(',').map((s)=>s.trim()).filter(Boolean),
          categories: form.categories,
          thumbnail_url: form.thumbnail_url || '',
          thumbnail_path: form.thumbnail_path || '',
          status: form.status || 'draft',
          slug,
        }
        if (!articleId) {
          const created = await request('/articles', { method:'POST', body: JSON.stringify({ ...payload, status:'draft' }) })
          setArticleId(created.id)
          setSavingNote('Autosaved')
          // navigate to canonical editor URL with id
          nav(`/editor/${created.id}`, { replace: true })
        } else {
          await request(`/articles/${articleId}`, { method:'PUT', body: JSON.stringify({ ...payload, status: form.status }) })
          setSavingNote('Autosaved')
          request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch(()=>{})
        }
      } catch {}
    }, 10000)
    return () => clearInterval(t)
  }, [articleId, form.title, form.content, form.tags, form.categories, form.status, slug])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
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
        // authors cannot publish directly; server also enforces
        status: form.status,
        slug: slug,
      }
      if (id) await request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await request('/articles', { method: 'POST', body: JSON.stringify(payload) })
      ui?.notify?.('Saved successfully', 'success')
      nav('/dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function wrapSelection(left, right) {
    const ta = editorRef.current
    if (!ta) return
    const start = ta.selectionStart || 0
    const end = ta.selectionEnd || 0
    const before = form.content.slice(0, start)
    const sel = form.content.slice(start, end)
    const after = form.content.slice(end)
    const next = `${before}${left}${sel || 'text'}${right}${after}`
    setForm({ ...form, content: next })
    setTimeout(() => { ta.focus(); ta.selectionStart = start + left.length; ta.selectionEnd = start + left.length + (sel || 'text').length }, 0)
  }
  function insertLine(prefix) {
    const ta = editorRef.current
    if (!ta) return
    const start = ta.selectionStart || 0
    const end = ta.selectionEnd || 0
    const content = form.content
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart)
    setForm({ ...form, content: next })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + prefix.length }, 0)
  }

  async function uploadOne(file) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/article-media`, {
      method: 'POST',
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      body: fd,
    })
    const data = await res.json().catch(()=>({}))
    if (!res.ok) throw new Error(data.message || 'Upload failed')
    return data.url
  }

  async function insertImages(files) {
    if (!files || files.length === 0) return
    const ta = editorRef.current
    const urls = []
    for (const f of files) {
      try { const url = await uploadOne(f); urls.push(url) } catch {}
    }
    if (urls.length === 0) return
    const md = urls.map((u) => `\n\n![image](${u})`).join('') + '\n\n'
    const start = ta?.selectionStart || form.content.length
    const before = form.content.slice(0, start)
    const after = form.content.slice(start)
    setForm({ ...form, content: before + md + after })
    setTimeout(() => { ta?.focus(); if (ta) { ta.selectionStart = ta.selectionEnd = start + md.length } }, 0)
  }

  function handleMediaSelect(e) { insertImages(e.target.files) }
  function handleDrop(e) { if (e.dataTransfer?.files?.length) { e.preventDefault(); insertImages(e.dataTransfer.files) } }
  function handlePaste(e) {
    const items = e.clipboardData?.items || []
    const files = []
    for (const it of items) { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f) } }
    if (files.length) { e.preventDefault(); insertImages(files) }
  }

  function insertLink() {
    const ta = editorRef.current
    const start = ta?.selectionStart || 0
    const end = ta?.selectionEnd || 0
    const before = form.content.slice(0, start)
    const sel = form.content.slice(start, end) || 'link text'
    const after = form.content.slice(end)
    const url = prompt('Enter URL', 'https://') || ''
    if (!url) return
    const md = `[${sel}](${url})`
    const next = before + md + after
    setForm({ ...form, content: next })
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = start + md.length } }, 0)
  }

  function insertHr() {
    const ta = editorRef.current
    const start = ta?.selectionStart || form.content.length
    const before = form.content.slice(0, start)
    const after = form.content.slice(start)
    const md = `\n\n---\n\n`
    setForm({ ...form, content: before + md + after })
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = start + md.length } }, 0)
  }

  function insertCodeBlock() {
    const ta = editorRef.current
    const lang = prompt('Language (optional)', 'javascript') || ''
    const start = ta?.selectionStart || 0
    const end = ta?.selectionEnd || 0
    const before = form.content.slice(0, start)
    const sel = form.content.slice(start, end) || 'code'
    const after = form.content.slice(end)
    const md = `\n\n\`\`\`${lang}\n${sel}\n\`\`\`\n\n`.replace(/\\`\\`\\`/g,'```')
    setForm({ ...form, content: before + md + after })
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = start + md.length } }, 0)
  }

  function clearFormatting() {
    const ta = editorRef.current
    const start = ta?.selectionStart || 0
    const end = ta?.selectionEnd || 0
    const before = form.content.slice(0, start)
    const sel = form.content.slice(start, end)
    const after = form.content.slice(end)
    const cleaned = sel.replace(/[\*\_\~\`]+/g, '').replace(/<\/?u>/g,'')
    setForm({ ...form, content: before + cleaned + after })
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = start; ta.selectionEnd = start + cleaned.length } }, 0)
  }

  function handleKeydown(e) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSelection('**','**'); return }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSelection('_','_'); return }
      if (e.key.toLowerCase() === 'u') { e.preventDefault(); wrapSelection('<u>','</u>'); return }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); insertLink(); return }
    }
    if (e.key === 'Enter') {
      const ta = editorRef.current
      if (!ta) return
      const pos = ta.selectionStart || 0
      const content = form.content
      const lineStart = content.lastIndexOf('\n', pos - 1) + 1
      const line = content.slice(lineStart, pos)
      const mNum = line.match(/^(\d+)\.\s+/)
      const bullet = /^(- \[ \] |-\s+)/.test(line) ? (line.startsWith('- [ ] ') ? '- [ ] ' : '- ') : ''
      if (mNum) {
        e.preventDefault()
        const n = parseInt(mNum[1] || '1', 10) + 1
        const insert = `\n${n}. `
        const before = content.slice(0, pos)
        const after = content.slice(pos)
        const next = before + insert + after
        setForm({ ...form, content: next })
        setTimeout(()=>{ ta.focus(); ta.selectionStart = ta.selectionEnd = pos + insert.length },0)
      } else if (bullet) {
        e.preventDefault()
        const insert = `\n${bullet}`
        const before = content.slice(0, pos)
        const after = content.slice(pos)
        const next = before + insert + after
        setForm({ ...form, content: next })
        setTimeout(()=>{ ta.focus(); ta.selectionStart = ta.selectionEnd = pos + insert.length },0)
      }
    }
  }

  return (
    <div className="container page">
      <h2>{id ? 'Edit Article' : 'New Article'}</h2>
      {savingNote && <p className="muted" style={{marginTop:-8}}>Status: {savingNote}</p>}
      <div className="editor-split">
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="editor-toolbar">
          <button type="button" className="btn" onClick={() => wrapSelection('**','**')}>Bold</button>
          <button type="button" className="btn" onClick={() => wrapSelection('_','_')}>Italic</button>
          <button type="button" className="btn" onClick={() => wrapSelection('<u>','</u>')}>Underline</button>
          <button type="button" className="btn" onClick={insertLink}>Link</button>
          <button type="button" className="btn" onClick={() => insertLine('# ')}>H1</button>
          <button type="button" className="btn" onClick={() => insertLine('## ')}>H2</button>
          <button type="button" className="btn" onClick={() => insertLine('### ')}>H3</button>
          <button type="button" className="btn" onClick={() => insertLine('> ')}>Quote</button>
          <button type="button" className="btn" onClick={() => wrapSelection('`','`')}>Code</button>
          <button type="button" className="btn" onClick={() => insertLine('- ')}>Bulleted</button>
          <button type="button" className="btn" onClick={() => insertLine('1. ')}>Ordered</button>
          <button type="button" className="btn" onClick={() => insertLine('- [ ] ')}>Task</button>
          <button type="button" className="btn" onClick={insertHr}>HR</button>
          <button type="button" className="btn" onClick={insertCodeBlock}>Code Block</button>
          <button type="button" className="btn" onClick={clearFormatting}>Clear</button>
          <input id="media-input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={handleMediaSelect} />
          <button type="button" className="btn btn-primary" onClick={() => document.getElementById('media-input').click()}>Add Image</button>
        </div>
        <div>
          <label>Thumbnail image</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} />
          {(thumbFile || form.thumbnail_url) && (
            <div style={{ marginTop: 8 }}>
              <img alt="thumbnail" src={thumbFile ? URL.createObjectURL(thumbFile) : form.thumbnail_url} style={{ maxWidth: '100%', borderRadius: 'var(--space-sm)', border: '1px solid var(--border)' }} />
            </div>
          )}
        </div>
        <textarea
          ref={editorRef}
          placeholder="Write your content in Markdown… (paste or drop images to insert)"
          rows={16}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onKeyDown={handleKeydown}
        />
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
            <option value="pending">Submit for review</option>
            {auth.user?.role === 'admin' && <option value="published">Published</option>}
          </select>
        </label>
        {auth.user?.role !== 'admin' && (
          <div className="muted" style={{ fontSize: '.85rem' }}>
            Authors can save drafts or submit for review. An admin will approve and publish.
          </div>
        )}
        <label>
          Slug:
          <input placeholder="post-slug" value={slug} onChange={(e)=>{ setSlug(e.target.value); setSlugTouched(true) }} />
          <div className="muted" style={{fontSize:'.85rem'}}>URL preview: {slug ? `${location.origin}/a/${slug}` : 'Will be generated from title'}</div>
        </label>
        {error && <p className="error">{error}</p>}
        {articleId && (
          <div style={{ display:'flex', gap:'var(--space-sm)', alignItems:'center', margin:'var(--space-sm) 0' }}>
            <button className="btn" type="button" onClick={async()=>{
              try {
                const r = await request(`/articles/${articleId}/preview`, { method:'POST' })
                const url = r?.url || (r?.token ? `/p/${r.token}` : '')
                if (url) {
                  try { await navigator.clipboard.writeText(url.startsWith('http') ? url : (location.origin + url)) } catch {}
                  ui.notify('Preview link copied to clipboard', 'success')
                }
              } catch {}
            }}>Get Preview Link</button>
            <span className="muted" style={{ fontSize: '.85rem' }}>Share this link to preview your draft without login.</span>
          </div>
        )}
        <button className={`btn btn-primary ${saving ? 'loading' : ''}`} type="submit" disabled={saving}>
          {saving ? 'Saving…' : (form.status === 'pending' && auth.user?.role !== 'admin' ? 'Submit for review' : 'Save')}
        </button>
      </form>
      <aside className="editor-preview">
        <div className="card">
          <h3 className="card-title">Live Preview</h3>
          <div className="markdown">
            {form.title && <h1>{form.title}</h1>}
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {form.content || ''}
            </ReactMarkdown>
          </div>
        </div>
      </aside>
      </div>
      {articleId && (
        <div className="section-card" style={{ marginTop: 16 }}>
          <h3 className="card-title">Revisions</h3>
          {revisions.length === 0 ? (
            <p className="muted">No revisions yet.</p>
          ) : (
            <ul className="list-clean">
              {revisions.map((r) => (
                <li key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span>{new Date(r.created_at).toLocaleString()} — {r.title}</span>
                  <button className="btn" onClick={async ()=>{ try { const a = await request(`/articles/${articleId}/revisions/${r.id}/restore`, { method:'POST' }); setForm({ ...form, title: a.title, content: a.content }); ui.notify('Revision restored', 'success'); request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch(()=>{}) } catch{} }}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
