import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'

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
  // Track last saved content to avoid redundant autosaves/revisions
  const lastSavedRef = useRef({ content: '' })
  const [autoSaving, setAutoSaving] = useState(false)
  // Diff modal state
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffLines, setDiffLines] = useState([])
  // Tag input state
  const tagInputRef = useRef(null)
  const [tagText, setTagText] = useState('')
  // Media library state
  const [mediaOpen, setMediaOpen] = useState(false)
  const [mediaItems, setMediaItems] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaMode, setMediaMode] = useState('inline') // inline | thumb
  const [mediaQuery, setMediaQuery] = useState('')
  const [mediaSort, setMediaSort] = useState('newest') // newest | oldest | name

  const formatBytes = (n) => {
    const num = Number(n||0)
    if (!num) return '—'
    const units = ['B','KB','MB','GB']
    let i = 0; let v = num
    while (v >= 1024 && i < units.length-1) { v /= 1024; i++ }
    return `${v.toFixed(v<10 && i>0 ? 1 : 0)} ${units[i]}`
  }

  // --- Simple line-level diff (LCS-based) for "Compare Changes" ---
  function computeLineDiff(aText, bText) {
    const a = String(aText || '').replace(/\r\n/g, '\n').split('\n')
    const b = String(bText || '').replace(/\r\n/g, '\n').split('\n')
    const n = a.length, m = b.length
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = 1 + dp[i + 1][j + 1]
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
    let i = 0, j = 0
    const out = []
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ t: 'eq', text: a[i] }); i++; j++; }
      else if (dp[i][j + 1] >= dp[i + 1][j]) { out.push({ t: 'add', text: b[j] }); j++; }
      else { out.push({ t: 'del', text: a[i] }); i++; }
    }
    while (i < n) { out.push({ t: 'del', text: a[i++] }) }
    while (j < m) { out.push({ t: 'add', text: b[j++] }) }
    return out
  }
  function openCompare() {
    const base = lastSavedRef.current?.content || ''
    const curr = form.content || ''
    const lines = computeLineDiff(base, curr)
    setDiffLines(lines)
    setDiffOpen(true)
  }
  const formatDate = (d) => {
    try { return new Date(d || Date.now()).toLocaleString() } catch { return '' }
  }
  const bucketForMode = (mode) => (mode === 'thumb' ? 'thumbnails' : 'article-media')

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
    }); setSlug(a.slug || slugify(a.title)); lastSavedRef.current.content = a.content || '' }).catch((e)=>{ if (import.meta.env.DEV) console.debug('load article failed', e) })
  }, [id, request])

  useEffect(() => { request('/categories').then(setAllCategories).catch((e)=>{ if (import.meta.env.DEV) console.debug('load categories failed', e) }) }, [request])
  // auto-generate slug when title changes unless user edited slug
  useEffect(() => { if (!slugTouched) setSlug(slugify(form.title)) }, [form.title, slugTouched])

  // load revisions when article id available
  useEffect(() => { if (articleId) request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch((e)=>{ if (import.meta.env.DEV) console.debug('load revisions failed', e) }) }, [articleId, request])

  // Derived tags array and suggestions
  const tagsList = useMemo(() => (form.tags || '').split(',').map((s)=>s.trim()).filter(Boolean), [form.tags])
  const tagSuggestions = useMemo(() => {
    const base = ['Next.js','React','Tailwind','TypeScript','UI']
    const fromCats = (allCategories || []).map((c)=>c?.name).filter(Boolean)
    return Array.from(new Set([...base, ...fromCats]))
  }, [allCategories])

  function setTags(list) {
    const unique = Array.from(new Set(list.map((t)=>t.toString().trim()).filter(Boolean)))
    setForm((f)=>({ ...f, tags: unique.join(', ') }))
  }
  function addTag(raw) {
    const t = (raw || '').trim()
    if (!t) return
    if (tagsList.some((x)=>x.toLowerCase() === t.toLowerCase())) return
    setTags([...tagsList, t])
    setTagText('')
    setTimeout(()=>{ try { tagInputRef.current?.focus() } catch (e) { if (import.meta.env.DEV) console.debug('focus tag input failed', e) } }, 0)
  }
  function removeTag(tag) {
    setTags(tagsList.filter((x)=>x.toLowerCase() !== String(tag).toLowerCase()))
  }
  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault()
      addTag(tagText.replace(/,$/, ''))
    } else if (e.key === 'Backspace' && !tagText) {
      // remove last tag when input empty
      const last = tagsList[tagsList.length - 1]
      if (last) removeTag(last)
    }
  }
  function handleTagBlur() {
    if (!tagText.trim()) return
    addTag(tagText)
  }

  // autosave draft every 10s when editing (content-only changes, local skeleton, no global loading)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        if (!form.title && !form.content) return
        const finalTagsArr = Array.from(new Set([...tagsList, ...(tagText.trim() ? [tagText.trim()] : [])]))
        const payload = {
          title: form.title || '(untitled)',
          content: form.content || '',
          tags: finalTagsArr,
          categories: form.categories,
          thumbnail_url: form.thumbnail_url || '',
          thumbnail_path: form.thumbnail_path || '',
          status: form.status || 'draft',
          slug,
        }
        // skip if content unchanged
        if ((payload.content || '') === (lastSavedRef.current.content || '')) return
        setAutoSaving(true)
        if (!articleId) {
          const created = await request('/articles', { method:'POST', body: JSON.stringify({ ...payload, status:'draft' }), noGlobalLoading: true })
          setArticleId(created.id)
          setSavingNote('Autosaved')
          // navigate to canonical editor URL with id
          nav(`/editor/${created.id}`, { replace: true })
        } else {
          await request(`/articles/${articleId}`, { method:'PUT', body: JSON.stringify({ ...payload, status: form.status }), noGlobalLoading: true })
          setSavingNote('Autosaved')
          request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch(()=>{})
        }
        lastSavedRef.current.content = payload.content || ''
      } catch (e) { if (import.meta.env.DEV) console.debug('editor autosave failed', e) }
      finally { setAutoSaving(false) }
    }, 10000)
    return () => clearInterval(t)
  }, [articleId, form.title, form.content, form.tags, form.categories, form.status, form.thumbnail_path, form.thumbnail_url, slug, request, nav, tagsList, tagText])

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
          try { const j = await res.json(); if (j?.message) msg = j.message } catch (e) { if (import.meta.env.DEV) console.debug('thumb upload parse failed', e) }
          throw new Error(msg)
        }
        const up = await res.json()
        thumbnail_url = up.url
        thumbnail_path = up.path || ''
      }
      const finalTagsArr = Array.from(new Set([...tagsList, ...(tagText.trim() ? [tagText.trim()] : [])]))
      const payload = {
        title: form.title,
        content: form.content,
        tags: finalTagsArr,
        categories: form.categories,
        thumbnail_url,
        thumbnail_path,
        // authors cannot publish directly; server also enforces
        status: form.status,
        slug: slug,
      }
      if (id) await request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await request('/articles', { method: 'POST', body: JSON.stringify(payload) })
      lastSavedRef.current.content = form.content || ''
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
      try { const url = await uploadOne(f); urls.push(url) } catch (e) { if (import.meta.env.DEV) console.debug('image upload failed', e) }
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

  // Open media library modal and load existing images for selection
  async function openMedia(mode = 'inline') {
    try {
      setMediaMode(mode)
      setMediaOpen(true)
      setMediaLoading(true)
      const path = mode === 'thumb' ? '/uploads/thumbnails?limit=100' : '/uploads/article-media?limit=100'
      const r = await request(path, { noGlobalLoading: true })
      setMediaItems(Array.isArray(r?.items) ? r.items : [])
    } catch (e) {
      ui?.notify?.(e?.message || 'Failed to load media', 'error')
      setMediaItems([])
    } finally {
      setMediaLoading(false)
    }
  }

  // Insert picked image or set as thumbnail
  function pickMedia(item) {
    if (!item?.url) return
    if (mediaMode === 'thumb') {
      setForm((f) => ({ ...f, thumbnail_url: item.url, thumbnail_path: item.path || '' }))
      setMediaOpen(false)
      return
    }
    const ta = editorRef.current
    const start = ta?.selectionStart || form.content.length
    const before = form.content.slice(0, start)
    const md = `\n\n![image](${item.url})\n\n`
    const after = form.content.slice(start)
    setForm({ ...form, content: before + md + after })
    setMediaOpen(false)
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = start + md.length } }, 0)
  }

  async function deleteMedia(item, e) {
    e?.stopPropagation?.()
    try {
      await request('/uploads/delete', { method: 'POST', body: JSON.stringify({ bucket: bucketForMode(mediaMode), path: item.path }), noGlobalLoading: true })
      setMediaItems((arr) => arr.filter((x) => x.path !== item.path))
      ui?.notify?.('Deleted', 'success')
    } catch (err) { ui?.notify?.(err?.message || 'Delete failed', 'error') }
  }
  async function renameMedia(item, e) {
    e?.stopPropagation?.()
    try {
      const ext = (item.name.split('.').pop() || '').toLowerCase()
      const base = item.name.replace(/\.[^.]+$/, '')
      const input = prompt('New file name (without extension)', base)
      if (!input || input === base) return
      const newName = `${input}.${ext}`
      const r = await request('/uploads/rename', { method: 'POST', body: JSON.stringify({ bucket: bucketForMode(mediaMode), path: item.path, newName }), noGlobalLoading: true })
      setMediaItems((arr) => arr.map((x) => x.path === item.path ? { ...x, name: newName, path: r.path || x.path, url: r.url || x.url } : x))
      ui?.notify?.('Renamed', 'success')
    } catch (err) { ui?.notify?.(err?.message || 'Rename failed', 'error') }
  }

  const itemsToShow = useMemo(() => {
    const q = mediaQuery.trim().toLowerCase()
    let list = Array.isArray(mediaItems) ? [...mediaItems] : []
    if (q) list = list.filter((it) => (it.name || '').toLowerCase().includes(q))
    if (mediaSort === 'name') list.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    else {
      const key = 'updated_at'
      list.sort((a,b)=>{
        const da = new Date(a[key] || a.created_at || 0).getTime()
        const db = new Date(b[key] || b.created_at || 0).getTime()
        return mediaSort === 'newest' ? db - da : da - db
      })
    }
    return list
  }, [mediaItems, mediaQuery, mediaSort])

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
    const cleaned = sel.replace(/[*_~`]+/g, '').replace(/<\/?u>/g,'')
    setForm({ ...form, content: before + cleaned + after })
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = start; ta.selectionEnd = start + cleaned.length } }, 0)
  }

  // Markdown sanitize schema extended to allow MathML/KaTeX output + safe inline SVG
  const mdSchema = {
    ...defaultSchema,
    tagNames: [
      ...((defaultSchema.tagNames || [])),
      'math','semantics','mrow','mi','mo','mn','msup','mfrac','msqrt','mroot','mtable','mtr','mtd','mspace','mstyle','annotation',
      'svg','g','path','circle','rect','line','polyline','polygon','ellipse','defs','linearGradient','radialGradient','stop','title','desc','symbol','use','clipPath','mask','pattern','view','foreignObject'
    ],
    attributes: {
      ...(defaultSchema.attributes || {}),
      a: [...(defaultSchema.attributes?.a || []), ['href'], ['target'], ['rel'], ['title']],
      code: [...(defaultSchema.attributes?.code || []), ['className']],
      pre: [...(defaultSchema.attributes?.pre || []), ['className']],
      span: [...(defaultSchema.attributes?.span || []), ['className'], ['style']],
      math: [...(defaultSchema.attributes?.math || []), ['display']],
      annotation: [...(defaultSchema.attributes?.annotation || []), ['encoding']],
      mtable: [...(defaultSchema.attributes?.mtable || []), ['rowspacing','columnspacing','displaystyle']],
      mtd: [...(defaultSchema.attributes?.mtd || []), ['columnalign']],
      // Safe inline SVG attributes
      svg: [...(defaultSchema.attributes?.svg || []), ['viewBox'], ['width'], ['height'], ['fill'], ['stroke'], ['stroke-width'], ['xmlns'], ['preserveAspectRatio'], ['aria-hidden'], ['focusable'], ['role'], ['version'], ['x'], ['y'], ['className'], ['style']],
      g:   [...(defaultSchema.attributes?.g || []), ['transform'], ['fill'], ['stroke'], ['opacity'], ['clip-path']],
      path:[...(defaultSchema.attributes?.path || []), ['d'], ['fill'], ['stroke'], ['stroke-width'], ['transform'], ['opacity'], ['fill-opacity'], ['stroke-linecap'], ['stroke-linejoin'], ['stroke-opacity'], ['clip-path']],
      circle:[...(defaultSchema.attributes?.circle || []), ['cx'], ['cy'], ['r'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      rect:[...(defaultSchema.attributes?.rect || []), ['x'], ['y'], ['width'], ['height'], ['rx'], ['ry'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      line:[...(defaultSchema.attributes?.line || []), ['x1'], ['y1'], ['x2'], ['y2'], ['stroke'], ['stroke-width'], ['opacity']],
      polyline:[...(defaultSchema.attributes?.polyline || []), ['points'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      polygon:[...(defaultSchema.attributes?.polygon || []), ['points'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      ellipse:[...(defaultSchema.attributes?.ellipse || []), ['cx'], ['cy'], ['rx'], ['ry'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      linearGradient:[...(defaultSchema.attributes?.linearGradient || []), ['id'], ['x1'], ['y1'], ['x2'], ['y2'], ['gradientUnits']],
      radialGradient:[...(defaultSchema.attributes?.radialGradient || []), ['id'], ['cx'], ['cy'], ['r'], ['fx'], ['fy'], ['gradientUnits']],
      stop:[...(defaultSchema.attributes?.stop || []), ['offset'], ['stop-color'], ['stop-opacity']],
      use:[...(defaultSchema.attributes?.use || []), ['href']],
      clipPath:[...(defaultSchema.attributes?.clipPath || []), ['id']],
      img: [...(defaultSchema.attributes?.img || []), ['src'], ['alt'], ['title'], ['width'], ['height'], ['loading'], ['decoding']]
    },
  }

  // ChatGPT-like link renderer: highlight domain, truncate long paths, external icon
  const LinkRenderer = ({ href = '', children, ...props }) => {
    let urlObj = null
    try { urlObj = new URL(href, window.location.origin) } catch { /* ignore invalid URL */ }
    const isHttp = !!urlObj && /^(http|https):$/i.test(urlObj.protocol)
    const external = isHttp && (urlObj.origin !== window.location.origin)

    const onlyChild = Array.isArray(children) && children.length === 1 ? children[0] : null
    const childText = typeof onlyChild === 'string' ? onlyChild.trim() : ''
    const norm = (s) => String(s || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')
    const isBare = !!childText && (norm(childText) === norm(href))

    const rel = external ? 'noopener noreferrer nofollow ugc' : undefined
    const target = external ? '_blank' : undefined
    const cls = `md-link ${external ? 'ext' : ''}`.trim()

    let content = children
    if (isBare && urlObj && isHttp) {
      const domain = urlObj.host
      let path = urlObj.pathname + (urlObj.search || '')
      if (path === '/' || !path) path = ''
      if (path.length > 28) {
        const parts = urlObj.pathname.split('/').filter(Boolean)
        const last = parts.slice(-2).join('/')
        path = `/${parts.length > 2 ? '…/' : ''}${last}` + (urlObj.search ? '…' : '')
      }
      content = (
        <>
          <span className="md-link-domain">{domain}</span>
          {path && <span className="md-link-path">{path}</span>}
        </>
      )
    }

    return (
      <a href={href} rel={rel} target={target} className={cls} {...props}>
        {content}
        {external && <span aria-hidden="true" className="ext-icon" style={{ marginLeft: 4 }}>↗</span>}
      </a>
    )
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
      <div className="editor-topbar">
        <div className="left" style={{display:'flex', alignItems:'center', gap:8}}>
          <h2 className="card-title" style={{ margin: 0 }}>{id ? 'Edit Article' : 'New Article'}</h2>
          <span className={`badge ${form.status}`}>{form.status}</span>
          {autoSaving ? (
            <span className="skeleton-line" style={{ width: 80, height: 10, borderRadius: 6 }} />
          ) : (
            savingNote && <span className="muted">• {savingNote}</span>
          )}
        </div>
        <div className="right" style={{ display:'flex', gap:8, alignItems:'center' }}>
          {articleId && (
            <button className="btn" type="button" onClick={async()=>{
              try {
                const r = await request(`/articles/${articleId}/preview`, { method:'POST' })
                const url = r?.url || (r?.token ? `/p/${r.token}` : '')
                if (url) {
                  try { await navigator.clipboard.writeText(url.startsWith('http') ? url : (location.origin + url)) } catch (e) { if (import.meta.env.DEV) console.debug('copy to clipboard failed', e) }
                  ui.notify('Preview link copied to clipboard', 'success')
                }
              } catch (e) { if (import.meta.env.DEV) console.debug('get preview link failed', e) }
            }}>Get Preview Link</button>
          )}
          <button className="btn" type="button" onClick={openCompare} disabled={(form.content || '') === (lastSavedRef.current.content || '')}>
            Compare Changes
          </button>
          <button className={`btn btn-primary ${saving ? 'loading' : ''}`} form="editor-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : (form.status === 'pending' && auth.user?.role !== 'admin' ? 'Submit for review' : 'Save')}
          </button>
        </div>
      </div>
      <div className="editor-split">
      <form id="editor-form" onSubmit={onSubmit} className="form">
        <div className="card">
          <input className="title-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="card">
          <label>Thumbnail image</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} />
          {(thumbFile || form.thumbnail_url) && (
            <div style={{ marginTop: 8 }}>
              <img alt="thumbnail" src={thumbFile ? URL.createObjectURL(thumbFile) : form.thumbnail_url} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => openMedia('thumb')}>Choose from Library</button>
          </div>
        </div>
        <div className="card">
          <div className="editor-toolbar sticky">
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
            <input id="media-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden onChange={handleMediaSelect} />
            <button type="button" className="btn btn-primary" onClick={() => document.getElementById('media-input').click()}>Upload Image</button>
            <button type="button" className="btn" onClick={() => openMedia('inline')}>From Library</button>
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
        </div>
        <div className="card">
          <label className="field-title">Tags</label>
          <input
            ref={tagInputRef}
            className="tag-input"
            placeholder="Add tag..."
            value={tagText}
            onChange={(e)=>setTagText(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={handleTagBlur}
          />
          {tagsList.length > 0 && (
            <div className="chips selected-tags" style={{ marginTop: 8 }}>
              {tagsList.map((t) => (
                <span key={t} className="chip tag-chip" role="button" tabIndex={0} title="Remove tag"
                  onClick={()=>removeTag(t)}
                  onKeyDown={(e)=>{ if (e.key==='Enter') removeTag(t) }}>
                  <span>{t}</span>
                </span>
              ))}
            </div>
          )}
          <div className="tag-divider" aria-hidden="true" />
          <div className="muted" style={{ marginTop: 12, marginBottom: 6 }}>Suggestions</div>
          <div className="chips">
            {tagSuggestions.filter((s)=> !tagsList.some((t)=>t.toLowerCase()===s.toLowerCase())).map((s) => (
              <button type="button" key={s} className="chip suggestion-chip" onClick={()=>addTag(s)}>{s}</button>
            ))}
          </div>
          <label style={{ marginTop: 12 }}>Categories:</label>
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
          <div className="status-chips" style={{ marginTop: 12 }}>
            <label className="field-title" style={{ marginBottom: 6 }}>Status</label>
            <div className="chips">
              {['draft','pending','published'].map((s) => {
                const disabled = s === 'published' && auth.user?.role !== 'admin'
                const active = form.status === s
                const label = s === 'pending' ? 'Submit for review' : (s.charAt(0).toUpperCase() + s.slice(1))
                return (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${active ? 'active' : ''}`}
                    disabled={disabled}
                    onClick={()=>{ if (!disabled) setForm({ ...form, status: s }) }}
                  >{label}</button>
                )
              })}
            </div>
          </div>
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
        </div>
        {error && <p className="error">{error}</p>}
        {/* Controls moved to the sticky topbar */}
      </form>
      <aside className="editor-preview">
        <div className="card">
          <h3 className="card-title">Live Preview</h3>
          <div className="markdown">
            {form.title && <h1>{form.title}</h1>}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, mdSchema]]}
              components={{ a: LinkRenderer }}
            >
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
                  <button className="btn" onClick={async ()=>{ try { const a = await request(`/articles/${articleId}/revisions/${r.id}/restore`, { method:'POST' }); setForm({ ...form, title: a.title, content: a.content }); ui.notify('Revision restored', 'success'); request(`/articles/${articleId}/revisions`, { noGlobalLoading: true }).then(setRevisions).catch((e)=>{ if (import.meta.env.DEV) console.debug('reload revisions failed', e) }) } catch(e){ if (import.meta.env.DEV) console.debug('restore revision failed', e) } }}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {diffOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDiffOpen(false)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Changes vs last saved</h3>
              <button className="btn" onClick={() => setDiffOpen(false)}>Close</button>
            </div>
            <div className="diff-view">
              <pre className="diff-pre">
                {diffLines.length === 0 ? (
                  <span className="muted">No changes</span>
                ) : (
                  diffLines.map((ln, i) => (
                    <div key={i} className={`diff-line ${ln.t}`}>
                      <span className="gutter" aria-hidden="true">{ln.t === 'add' ? '+' : (ln.t === 'del' ? '-' : ' ')}</span>
                      <span className="text">{ln.text || '\u00A0'}</span>
                    </div>
                  ))
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
      {mediaOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setMediaOpen(false)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{mediaMode === 'thumb' ? 'Choose Thumbnail' : 'Media Library'}</h3>
              <button className="btn" onClick={() => setMediaOpen(false)}>Close</button>
            </div>
            {mediaLoading ? (
              <div className="media-grid skeleton">
                {Array.from({ length: 12 }).map((_,i)=> (
                  <div key={i} className="media-card"><div className="skeleton-thumb" style={{ height: 120 }} /></div>
                ))}
              </div>
            ) : itemsToShow.length === 0 ? (
              <div className="muted" style={{ padding:'24px 0' }}>No media found.</div>
            ) : (
              <>
                <div style={{ display:'flex', gap:8, alignItems:'center', margin:'8px 0' }}>
                  <input placeholder="Search media" value={mediaQuery} onChange={(e)=>setMediaQuery(e.target.value)} />
                  <select value={mediaSort} onChange={(e)=>setMediaSort(e.target.value)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                  </select>
                </div>
                <div className="media-grid">
                  {itemsToShow.map((it) => (
                    <div key={it.path} className="media-card" role="button" tabIndex={0} onClick={() => pickMedia(it)} onKeyDown={(e)=>{ if(e.key==='Enter') pickMedia(it) }} title={it.name}>
                      <img src={it.url} alt={it.name} loading="lazy" decoding="async" />
                      <div className="media-actions" aria-hidden="false">
                        <button className="icon-btn" title="Rename" onClick={(e)=>renameMedia(it,e)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21.41 6.34a1.25 1.25 0 000-1.77l-2.99-2.99a1.25 1.25 0 00-1.77 0l-1.83 1.83 3.75 3.75 1.84-1.82z"></path></svg>
                        </button>
                        <button className="icon-btn" title="Delete" onClick={(e)=>deleteMedia(it,e)}>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
