import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import useMeta from '../utils/useMeta.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
const Comments = lazy(() => import('../components/Comments.jsx'))
import ArticleCard from '../components/ArticleCard.jsx'
import ArticleSkeleton from '../components/ArticleSkeleton.jsx'

export default function Article() {
  const { id, slug } = useParams()
  const { request, ui } = useAuth()
  const requestRef = useRef(request)
  useEffect(() => { requestRef.current = request }, [request])
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState(0)
  const [related, setRelated] = useState([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [toc, setToc] = useState([])
  const startRef = useRef(0)
  const articleIdRef = useRef(null)
  // Text-to-Speech (TTS)
  const [ttsSupported, setTtsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [rate, setRate] = useState(1)
  const utterRef = useRef(null)
  // Reader controls
  const [fontScale, setFontScale] = useState(() => {
    try { return Math.min(1.6, Math.max(0.9, Number(localStorage.getItem('reader.fontScale')) || 1)) } catch { return 1 }
  })
  const [layoutWidth, setLayoutWidth] = useState(() => {
    try { return localStorage.getItem('reader.layoutWidth') || 'narrow' } catch { return 'narrow' }
  })
  const [activeHeading, setActiveHeading] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  // Reader font family options
  const fontOptions = useMemo(() => ([
    { id: 'system', label: 'System', value: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
    { id: 'sans', label: 'Sans', value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
    { id: 'serif', label: 'Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
    { id: 'mono', label: 'Mono', value: '"JetBrains Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  ]), [])
  const [fontId, setFontId] = useState(() => {
    try { return localStorage.getItem('reader.fontId') || 'system' } catch { return 'system' }
  })
  const fontFamily = useMemo(() => (fontOptions.find(f => f.id === fontId)?.value || fontOptions[0].value), [fontId, fontOptions])
  // Offline reading state
  const [offlineSaved, setOfflineSaved] = useState(false)
  // Comments meta
  const [commentCount, setCommentCount] = useState(0)
  const [commentsKey, setCommentsKey] = useState(0)
  const [shareCount, setShareCount] = useState(() => Number(article?.share_count || 0))
  const [focusCommentKey, setFocusCommentKey] = useState(0)
  const [showComments, setShowComments] = useState(false)
  // Local busy states for small actions (avoid global loader)
  const [likeBusy, setLikeBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  // Offline helpers (memoized)
  const readOfflineStore = useCallback(() => {
    try { return JSON.parse(localStorage.getItem('offline.articles') || '{}') } catch { return {} }
  }, [])

  // Compute and set anchor offset to keep headings visible below sticky controls
  const measureAnchorOffset = useCallback(() => {
    try {
      const rc = document.querySelector('.reader-controls')
      const h = rc ? Math.ceil(rc.getBoundingClientRect().height + 12) : 96
      document.documentElement.style.setProperty('--anchor-offset', `${h}px`)
    } catch (e) { if (import.meta.env.DEV) console.debug('measure anchor offset failed', e) }
  }, [])
  useEffect(() => {
    measureAnchorOffset()
    window.addEventListener('resize', measureAnchorOffset)
    return () => window.removeEventListener('resize', measureAnchorOffset)
  }, [measureAnchorOffset])
  const writeOfflineStore = useCallback((obj) => {
    try { localStorage.setItem('offline.articles', JSON.stringify(obj)) } catch (e) { if (import.meta.env.DEV) console.debug('offline write failed', e) }
  }, [])
  const getOfflineArticle = useCallback((aid, aslug) => {
    const store = readOfflineStore()
    if (aid && store[aid]?.article) return store[aid].article
    const arr = Object.values(store)
    const hit = arr.find((x) => x?.article?.slug === aslug)
    return hit?.article || null
  }, [readOfflineStore])

  useEffect(() => {
    setLoading(true)
    setArticle(null)
    setError('')
    
    const path = slug ? `/articles/slug/${slug}` : `/articles/${id}`
    requestRef.current(path, { noGlobalLoading: true })
      .then((a) => {
        setArticle(a)
        articleIdRef.current = a.id
        const aid = a.id
        requestRef.current(`/likes/status/${aid}`, { noGlobalLoading: true }).then((r) => setLiked(Boolean(r.liked))).catch((e) => { if (import.meta.env.DEV) console.debug('likes status failed', e) })
        requestRef.current(`/bookmarks/status/${aid}`, { noGlobalLoading: true }).then((r) => setSaved(Boolean(r.saved))).catch((e) => { if (import.meta.env.DEV) console.debug('bookmarks status failed', e) })
        setRelatedLoading(true)
        requestRef.current(`/articles/${aid}/related`, { noGlobalLoading: true })
          .then((r) => setRelated(Array.isArray(r) ? r : []))
          .catch(() => setRelated([]))
          .finally(() => setRelatedLoading(false))
      })
      .catch((e) => {
        // offline fallback
        const off = getOfflineArticle(id, slug)
        if (off) {
          setArticle(off)
          articleIdRef.current = off.id
          setError('')
        } else {
          setError(e.message)
        }
      })
      .finally(() => setLoading(false))
  }, [id, slug, getOfflineArticle])

  useEffect(() => {
    startRef.current = Date.now()
    return () => {
      const secs = Math.round((Date.now() - startRef.current) / 1000)
      const aid = articleIdRef.current || id
      if (secs > 0 && aid) {
        requestRef.current('/reads', { method: 'POST', body: JSON.stringify({ article_id: aid, duration_seconds: secs }) }).catch((e) => { if (import.meta.env.DEV) console.debug('reads post failed', e) })
      }
    }
  }, [id, slug])

  // Reading progress across the article content
  useEffect(() => {
    const handler = () => {
      const el = document.querySelector('.markdown')
      if (!el) return setProgress(0)
      const docHeight = el.scrollHeight
      const viewH = window.innerHeight
      const maxScrollable = Math.max(1, docHeight - viewH)
      const scrolled = Math.min(
        Math.max(window.scrollY - (el.getBoundingClientRect().top + window.scrollY - 0), 0),
        maxScrollable,
      )
      const pct = Math.round((scrolled / maxScrollable) * 100)
      setProgress(Number.isFinite(pct) ? pct : 0)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  // Build TOC from rendered headings (h2/h3) for consistent anchors
  useEffect(() => {
    const t = setTimeout(() => {
      const list = []
      document.querySelectorAll('.markdown h2, .markdown h3').forEach((el) => {
        const text = el.textContent || ''
        const level = el.tagName === 'H2' ? 2 : 3
        let idAttr = el.getAttribute('id')
        if (!idAttr) {
          idAttr = text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
          if (idAttr) el.setAttribute('id', idAttr)
        }
        if (idAttr) list.push({ id: idAttr, text, level })
      })
      setToc(list)
    }, 0)
    return () => clearTimeout(t)
  }, [article?.content])

  // If the URL has a hash, scroll to it below the sticky controls and highlight it
  useEffect(() => {
    const hash = (typeof window !== 'undefined' && window.location.hash) ? window.location.hash.slice(1) : ''
    if (!hash) return
    const t = setTimeout(() => {
      const el = document.getElementById(hash)
      if (!el) return
      el.classList.add('anchor-highlight')
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => { el.classList.remove('anchor-highlight') }, 1600)
    }, 0)
    return () => clearTimeout(t)
  }, [article?.content])

  // Persist reader prefs
  useEffect(() => { try { localStorage.setItem('reader.fontScale', String(fontScale)) } catch (e) { if (import.meta.env.DEV) console.debug('persist fontScale failed', e) } }, [fontScale])
  useEffect(() => { try { localStorage.setItem('reader.layoutWidth', layoutWidth) } catch (e) { if (import.meta.env.DEV) console.debug('persist layoutWidth failed', e) } }, [layoutWidth])
  useEffect(() => { try { localStorage.setItem('reader.fontId', fontId) } catch (e) { if (import.meta.env.DEV) console.debug('persist fontId failed', e) } }, [fontId])

  // Scrollspy for TOC
  useEffect(() => {
    if (!toc.length) return
    const headings = Array.from(document.querySelectorAll('.markdown h2, .markdown h3')).filter(el => el.id)
    if (!headings.length) return
    const onScroll = () => {
      const css = getComputedStyle(document.documentElement)
      const off = parseInt(css.getPropertyValue('--anchor-offset'))
      const top = window.scrollY + (Number.isFinite(off) ? off : 100)
      let current = headings[0]?.id || ''
      for (const el of headings) {
        if (el.getBoundingClientRect().top + window.scrollY <= top) current = el.id
        else break
      }
      setActiveHeading(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [toc])

  // Keep offline save indicator in sync
  useEffect(() => {
    if (!article?.id) { setOfflineSaved(false); return }
    const store = readOfflineStore()
    setOfflineSaved(Boolean(store[article.id]))
  }, [article?.id, readOfflineStore])

  // Keyboard shortcuts: -/+ font, w width, j/k headings
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = e.target?.tagName?.toLowerCase?.() || ''
      if (['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable) return
      const k = e.key
      if (k === '-' || k === '_') {
        setFontScale((s) => Math.max(0.9, +(s - 0.1).toFixed(2)))
      } else if (k === '=' || k === '+') {
        setFontScale((s) => Math.min(1.6, +(s + 0.1).toFixed(2)))
      } else if (k === 'w' || k === 'W') {
        setLayoutWidth((w) => (w === 'narrow' ? 'wide' : 'narrow'))
      } else if (k === 'j' || k === 'J') {
        jumpToHeading(1)
      } else if (k === 'k' || k === 'K') {
        jumpToHeading(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toc])

  const jumpToHeading = (dir) => {
    const headings = Array.from(document.querySelectorAll('.markdown h2, .markdown h3')).filter((el) => el.id)
    if (!headings.length) return
    const css = getComputedStyle(document.documentElement)
    const off = parseInt(css.getPropertyValue('--anchor-offset'))
    const y = window.scrollY + (Number.isFinite(off) ? off : 100)
    let idx = 0
    for (let i = 0; i < headings.length; i++) {
      const top = headings[i].getBoundingClientRect().top + window.scrollY
      if (top <= y) idx = i
      else break
    }
    const target = dir > 0 ? headings[Math.min(idx + 1, headings.length - 1)] : headings[Math.max(0, idx - 1)]
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Plain text for TTS (strip code/markdown)
  const plainText = useMemo(() => {
    const txt = article?.content || ''
    return txt
      .replace(/```[\s\S]*?```/g, '') // remove fenced code blocks
      .replace(/`[^`]*`/g, '') // inline code
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // links -> label
      .replace(/[#*_>`]/g, '') // markdown markers
  }, [article?.content])

  // Init TTS support + cleanup on unmount
  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)
    return () => { try { window.speechSynthesis?.cancel?.() } catch (e) { if (import.meta.env.DEV) console.debug('tts cancel failed', e) } }
  }, [])

  // Stop TTS when navigating to a different article
  useEffect(() => {
    if (!ttsSupported) return
    try { window.speechSynthesis.cancel() } catch (e) { if (import.meta.env.DEV) console.debug('tts stop failed', e) }
    setIsSpeaking(false)
    setIsPaused(false)
    utterRef.current = null
  }, [id, slug, ttsSupported])

  // Resume reading position per-article (restore)
  const posKey = useMemo(() => (article?.id ? `reader.pos:${article.id}` : null), [article?.id])
  useEffect(() => {
    if (!article || !posKey) return
    if (window.location.hash) return // respect direct anchor links
    try {
      const y = Number(localStorage.getItem(posKey))
      if (Number.isFinite(y) && y > 0) {
        const t = setTimeout(() => { window.scrollTo({ top: y, behavior: 'auto' }) }, 0)
        return () => clearTimeout(t)
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('restore pos failed', e) }
  }, [article, posKey])

  // Persist reading position (throttled)
  useEffect(() => {
    if (!article || !posKey) return
    let timeout
    const onScroll = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        try { localStorage.setItem(posKey, String(window.scrollY)) } catch (e) { if (import.meta.env.DEV) console.debug('persist pos failed', e) }
      }, 250)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timeout) clearTimeout(timeout)
    }
  }, [article, posKey])

  const readingMinutes = useMemo(() => {
    const text = article?.content || ''
    const words = text.trim().split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.ceil(words / 200))
  }, [article?.content])

  const excerpt = useMemo(() => (article?.content || '').replace(/[#*_>`]/g, '').slice(0, 160), [article?.content])
  useMeta({
    title: article ? `${article.title} — ${import.meta.env.VITE_APP_NAME || 'Readoft'}` : `${import.meta.env.VITE_APP_NAME || 'Readoft'}`,
    description: excerpt,
    image: article?.thumbnail_url || undefined,
    canonical: article ? (article.slug ? `/a/${article.slug}` : `/article/${article.id}`) : undefined,
  })
  // keep local shareCount in sync when article changes
  useEffect(() => { setShareCount(Number(article?.share_count || 0)) }, [article?.share_count])

  if (error) return <div className="container page"><p className="error">{error}</p></div>
  if (loading || !article) return <ArticleSkeleton />

  const toggleLike = async () => {
    if (likeBusy) return
    setLikeBusy(true)
    try {
      if (!liked) {
        const resp = await request(`/likes/${article.id}`, { method: 'POST', noGlobalLoading: true })
        if (resp?.liked || resp?.success) {
          setLiked(true)
          setArticle((prev) => ({ ...prev, like_count: (prev?.like_count || 0) + 1 }))
        }
      } else {
        const resp = await request(`/likes/${article.id}`, { method: 'DELETE', noGlobalLoading: true })
        if (resp?.liked === false || resp?.success !== false) {
          setLiked(false)
          setArticle((prev) => ({ ...prev, like_count: Math.max(0, (prev?.like_count || 0) - 1) }))
        }
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('toggle like failed', e) } finally { setLikeBusy(false) }
  }
  const follow = async () => {
    if (followBusy) return
    setFollowBusy(true)
    try {
      await request(`/follows/${article.author_id}`, { method: 'POST', noGlobalLoading: true })
      ui?.notify?.('Following author', 'success')
    } catch (e) { if (import.meta.env.DEV) console.debug('follow failed', e) } finally { setFollowBusy(false) }
  }
  const toggleSave = async () => {
    if (saveBusy) return
    setSaveBusy(true)
    try {
      if (!saved) {
        const r = await request(`/bookmarks/${article.id}`, { method: 'POST', noGlobalLoading: true })
        if (r?.saved) setSaved(true)
      } else {
        const r = await request(`/bookmarks/${article.id}`, { method: 'DELETE', noGlobalLoading: true })
        if (r && r.saved === false) setSaved(false)
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('toggle save failed', e) } finally { setSaveBusy(false) }
  }
  const copyLink = async () => {
    try {
      const link = article.slug ? `${location.origin}/a/${article.slug}` : `${location.origin}/article/${article.id}`
      await navigator.clipboard.writeText(link)
      ui?.notify?.('Link copied', 'success')
    } catch (e) { if (import.meta.env.DEV) console.debug('copy link failed', e) }
  }
  const share = async () => {
    try {
      const link = article.slug ? `${location.origin}/a/${article.slug}` : `${location.origin}/article/${article.id}`
      if (navigator.share) {
        await navigator.share({ title: article.title, text: `${article.title} — ${readingMinutes} min read`, url: link })
      } else {
        await navigator.clipboard.writeText(link)
        ui?.notify?.('Link copied', 'success')
      }
      setShareCount((n) => (Number.isFinite(n) ? n + 1 : 1))
    } catch (e) { if (import.meta.env.DEV) console.debug('share failed', e) }
  }

  const goToComments = () => {
    try {
      setShowComments(true)
      setCommentsKey((k) => k + 1)
      setFocusCommentKey((k) => k + 1)
    } catch (e) { if (import.meta.env.DEV) console.debug('scroll to comments failed', e) }
  }

  // Smooth-scroll to a heading from TOC and briefly highlight it so it's visible under sticky controls
  const handleTocClick = (e, id) => {
    try {
      e.preventDefault()
      const el = document.getElementById(id)
      if (!el) return
      // Remove previous highlight if any
      document.querySelectorAll('.anchor-highlight').forEach((n) => n.classList.remove('anchor-highlight'))
      // Highlight and smooth scroll
      el.classList.add('anchor-highlight')
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      try { window.history.replaceState(null, '', `#${id}`) } catch (e) { if (import.meta.env.DEV) console.debug('replaceState failed', e) }
      // Clean up highlight after animation
      setTimeout(() => { el.classList.remove('anchor-highlight') }, 1600)
    } catch (err) { if (import.meta.env.DEV) console.debug('toc click failed', err) }
  }

  // ---- TTS helpers ----
  const startTTS = () => {
    if (!ttsSupported || !plainText.trim()) return
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(plainText)
      utter.rate = rate
      utter.onend = () => { setIsSpeaking(false); setIsPaused(false); utterRef.current = null }
      utter.onerror = () => { setIsSpeaking(false); setIsPaused(false); utterRef.current = null }
      utterRef.current = utter
      window.speechSynthesis.speak(utter)
      setIsSpeaking(true)
      setIsPaused(false)
    } catch (e) { if (import.meta.env.DEV) console.debug('start tts failed', e) }
  }
  const pauseTTS = () => { try { window.speechSynthesis.pause(); setIsPaused(true) } catch (e) { if (import.meta.env.DEV) console.debug('pause tts failed', e) } }
  const resumeTTS = () => { try { window.speechSynthesis.resume(); setIsPaused(false) } catch (e) { if (import.meta.env.DEV) console.debug('resume tts failed', e) } }
  const stopTTS = () => { try { window.speechSynthesis.cancel(); setIsSpeaking(false); setIsPaused(false); utterRef.current = null } catch (e) { if (import.meta.env.DEV) console.debug('stop tts failed', e) } }

  // extend sanitize schema to keep ids and code classes
  const mdSchema = {
    ...defaultSchema,
    attributes: {
      ...(defaultSchema.attributes || {}),
      code: [...(defaultSchema.attributes?.code || []), ['className']],
      pre: [...(defaultSchema.attributes?.pre || []), ['className']],
      h1: [...(defaultSchema.attributes?.h1 || []), ['id']],
      h2: [...(defaultSchema.attributes?.h2 || []), ['id']],
      h3: [...(defaultSchema.attributes?.h3 || []), ['id']],
      h4: [...(defaultSchema.attributes?.h4 || []), ['id']],
      h5: [...(defaultSchema.attributes?.h5 || []), ['id']],
      h6: [...(defaultSchema.attributes?.h6 || []), ['id']],
    },
  }
  const saveOffline = () => {
    if (!article) return
    const store = readOfflineStore()
    store[article.id] = { article, saved_at: Date.now() }
    writeOfflineStore(store)
    setOfflineSaved(true)
    try { ui?.notify?.('Saved for offline use', 'success') } catch (e) { if (import.meta.env.DEV) console.debug('notify failed', e) }
  }
  const removeOffline = () => {
    if (!article) return
    const store = readOfflineStore()
    delete store[article.id]
    writeOfflineStore(store)
    setOfflineSaved(false)
    try { ui?.notify?.('Removed offline copy', 'info') } catch (e) { if (import.meta.env.DEV) console.debug('notify failed', e) }
  }

  // Code block with language label + line numbers and Copy
  const CodeBlock = ({ className, children, ...props }) => {
    const preRef = useRef(null)
    const [lineCount, setLineCount] = useState(1)
    useEffect(() => {
      const text = preRef.current?.innerText || ''
      const count = text ? text.split('\n').length : 1
      setLineCount(count)
    }, [children])
    const lang = (className || '').match(/language-([a-z0-9+#-]+)/i)?.[1] || ''
    const onCopy = async (e) => {
      try {
        const txt = preRef.current?.innerText || ''
        await navigator.clipboard.writeText(txt)
        const btn = e.currentTarget
        const prev = btn.textContent
        btn.textContent = 'Copied'
        setTimeout(() => { btn.textContent = prev }, 1200)
      } catch (err) { if (import.meta.env.DEV) console.debug('copy code failed', err) }
    }
    const nums = Array.from({ length: lineCount })
    return (
      <div className="code-block" style={{ position: 'relative' }}>
        {lang && <span className="lang-badge" style={{ position:'absolute', top:8, left:8, fontSize:'.75rem', opacity:.8 }}>{lang}</span>}
        <button className="copy-btn" onClick={onCopy} style={{ position:'absolute', top:8, right:8, zIndex:2, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(255,255,255,0.06)' }}>Copy</button>
        <div className="code-grid" style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:8 }}>
          <ol className="line-nums" style={{ listStyle:'none', margin:0, padding:'8px 8px 8px 12px', textAlign:'right', userSelect:'none', color:'var(--muted)', borderRight:'1px solid var(--border)' }}>
            {nums.map((_, i) => (<li key={i} style={{ lineHeight:'1.5', fontVariantNumeric:'tabular-nums' }}>{i + 1}</li>))}
          </ol>
          <pre ref={preRef} style={{ margin:0 }}><code className={className} {...props}>{children}</code></pre>
        </div>
      </div>
    )
  }
  const CodeRenderer = ({ inline, className, children, ...props }) => {
    if (inline) return <code className={className} {...props}>{children}</code>
    return <CodeBlock className={className} {...props}>{children}</CodeBlock>
  }
  // Reusable action bar (like, comments, follow, save, share, copy, offline, report)
  const ActionsBar = () => (
    <div className="btn-group" style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
      <button className={`btn icon-btn with-count ${liked ? 'active' : ''}`} aria-label={`${liked ? 'Unlike' : 'Like'} (${article.like_count})`} title={liked ? 'Unlike' : 'Like'} onClick={toggleLike} disabled={likeBusy}>
        {likeBusy ? (
          <div className="spinner-sm" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.22 2.5C11.53 5.01 13.2 4 14.94 4 17.44 4 19.44 6 19.44 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
        )}
        <span className="btn-count">{article.like_count}</span>
      </button>
      <button className="btn icon-btn with-count" aria-label={`Comments (${commentCount})`} title="Comments" onClick={goToComments}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M21 6h-18v12h4v4l4-4h10z"></path></svg>
        <span className="btn-count">{commentCount}</span>
      </button>
      <button className="btn icon-btn" aria-label="Follow Author" title="Follow Author" onClick={follow} disabled={followBusy}>
        {followBusy ? (
          <div className="spinner-sm" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8v-1c0-3.31 4.03-5 7-5s7 1.69 7 5v1H5z"></path><path d="M19 8h-2V6h-2V4h2V2h2v2h2v2h-2v2z"></path></svg>
        )}
      </button>
      <button className={`btn icon-btn ${saved ? 'active' : ''}`} aria-label={saved ? 'Saved' : 'Save'} title={saved ? 'Saved' : 'Save'} onClick={toggleSave} disabled={saveBusy}>
        {saveBusy ? (
          <div className="spinner-sm" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M6 4h12v16l-6-4-6 4z"></path></svg>
        )}
      </button>
      <button className="btn icon-btn with-count" aria-label={`Share (${shareCount})`} title="Share" onClick={share}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M12 3l4 4h-3v6h-2V7H8l4-4z"></path><path d="M5 13h14v8H5z"></path></svg>
        <span className="btn-count">{shareCount}</span>
      </button>
      <button className="btn icon-btn" aria-label="Copy Link" title="Copy Link" onClick={copyLink}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M3.9 12a5 5 0 015-5h3v2H8.9a3 3 0 000 6H12v2H8.9a5 5 0 01-5-5zm7.1 1h3.1a3 3 0 000-6H12V5h2.1a5 5 0 110 10H12v-2z"></path></svg>
      </button>
      <button className={`btn icon-btn ${offlineSaved ? 'active' : ''}`} aria-label={offlineSaved ? 'Offline Saved' : 'Save Offline'} title={offlineSaved ? 'Offline Saved' : 'Save Offline'} onClick={offlineSaved ? removeOffline : saveOffline}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M5 20h14v-2H5v2z"></path><path d="M11 4h2v8h3l-4 4-4-4h3V4z"></path></svg>
      </button>
      <button className="btn icon-btn" aria-label="Report" title="Report" onClick={async()=>{
        if (reportBusy) return
        setReportBusy(true)
        try {
          const reason = prompt('Why are you reporting this article?') || ''
          if (!reason.trim()) return
          await request('/reports', { method:'POST', body: JSON.stringify({ target_type:'post', target_id: article.id, reason }), noGlobalLoading: true })
          ui.notify('Report submitted. Thank you.', 'info')
        } catch (e) { if (import.meta.env.DEV) console.debug('report post failed', e) } finally { setReportBusy(false) }
      }} disabled={reportBusy}>
        {reportBusy ? (
          <div className="spinner-sm" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M4 4h10l-1-2h7v13h-7l1 2H4z"></path></svg>
        )}
      </button>
    </div>
  )

  return (
    <div className="container page article-page">
      {article && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          datePublished: article.created_at,
          dateModified: article.updated_at || article.created_at,
          author: article.author?.name ? { "@type": "Person", name: article.author.name } : undefined,
          image: article.thumbnail_url || undefined,
          mainEntityOfPage: { "@type": "WebPage", "@id": article.slug ? `/a/${article.slug}` : `/article/${article.id}` },
        }) }} />
      )}
      <div className="read-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      {article.thumbnail_url && (
        <img src={article.thumbnail_url} alt="thumbnail" className="hero-thumb" loading="lazy" decoding="async" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{article.title}</h1>
          <div className="muted">{readingMinutes} min read</div>
          <div className="author-chip" style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:6 }}>
            {article.author?.avatar_url ? (
              <img src={article.author.avatar_url} alt="author avatar" className="avatar" loading="lazy" decoding="async" style={{ width:28, height:28 }} />
            ) : (
              <span className="avatar-fallback" style={{ width:28, height:28 }}>{(article.author?.name || 'U').slice(0,1).toUpperCase()}</span>
            )}
            <a href={`/author/${article.author_id}`} className="author-name">{article.author?.name || 'Author'}</a>
          </div>
          <p className="muted">{new Date(article.created_at).toLocaleString()} • {article.like_count} likes</p>
        </div>
        <a className="btn" href={`/author/${article.author_id}`}>View Author</a>
      </div>
      {/* Actions bar moved to end of article content */}
      <div className="section-card reader-controls">
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="muted">Text size</span>
            <div className="btn-group" style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
              <button className="btn" aria-label="Decrease text size" onClick={() => setFontScale(s => Math.max(0.9, +(s - 0.1).toFixed(2)))}>A-</button>
              <span className="font-size-indicator" aria-hidden>{Math.round(fontScale * 100)}%</span>
              <button className="btn" aria-label="Increase text size" onClick={() => setFontScale(s => Math.min(1.6, +(s + 0.1).toFixed(2)))}>A+</button>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="muted">Width</span>
            <button className="btn" onClick={() => setLayoutWidth(w => w === 'narrow' ? 'wide' : 'narrow')}>{layoutWidth === 'narrow' ? 'Narrow' : 'Wide'}</button>
            {toc.length > 0 && (
              <button className="btn" onClick={() => setFocusMode(f => !f)}>{focusMode ? 'Show TOC' : 'Focus mode'}</button>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="muted">Font</span>
            <select className="btn" value={fontId} onChange={(e) => setFontId(e.target.value)} style={{ padding:'6px 8px' }}>
              {fontOptions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          {ttsSupported && (
            <div className="tts-controls" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button className="btn icon-btn" aria-label="Listen" title="Listen" onClick={startTTS} disabled={isSpeaking && !isPaused}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
              </button>
              <button className="btn icon-btn" aria-label={isPaused ? 'Resume' : 'Pause'} title={isPaused ? 'Resume' : 'Pause'} onClick={() => (isPaused ? resumeTTS() : pauseTTS())} disabled={!isSpeaking}>
                {isPaused ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"></path></svg>
                )}
              </button>
              <button className="btn icon-btn" aria-label="Stop" title="Stop" onClick={stopTTS} disabled={!isSpeaking}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 6h12v12H6z"></path></svg>
              </button>
              <span className="muted" style={{ fontSize: '.85rem', minWidth: 40, textAlign:'center' }}>{rate.toFixed(1)}x</span>
              <button className="btn icon-btn" aria-label="Slower" title="Slower" onClick={() => setRate(r => Math.max(0.8, +(r - 0.1).toFixed(2)))}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M5 11h14v2H5z"></path></svg>
              </button>
              <button className="btn icon-btn" aria-label="Faster" title="Faster" onClick={() => setRate(r => Math.min(1.8, +(r + 0.1).toFixed(2)))}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z"></path></svg>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={`markdown-layout ${layoutWidth} ${focusMode ? 'focus' : ''}`} style={{ display: 'grid', gridTemplateColumns: (!focusMode && toc.length) ? 'minmax(0,1fr) 280px' : '1fr', gap: 24 }}>
        <div className="markdown" style={{ fontSize: `${fontScale}rem`, maxWidth: layoutWidth === 'narrow' ? '740px' : 'none', fontFamily }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkSlug]} rehypePlugins={[[rehypeSanitize, mdSchema], rehypeHighlight]} components={{ code: CodeRenderer }}>
          {article.content || ''}
          </ReactMarkdown>
        </div>
        {!focusMode && toc.length > 0 && (
          <aside className="toc" style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
            <div className="section-card">
              <h4 style={{marginTop:0}}>Contents</h4>
              <nav aria-label="Table of contents">
                <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                  {toc.map((h) => (
                    <li key={h.id} style={{ margin: '6px 0', paddingLeft: h.level === 3 ? 12 : 0 }}>
                      <a
                        className={h.id === activeHeading ? 'active' : ''}
                        href={`#${h.id}`}
                        onClick={(e) => handleTocClick(e, h.id)}
                        style={h.id === activeHeading ? { fontWeight: 600, textDecoration: 'underline' } : undefined}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        )}
        {/* Author box under content */}
        <div className="section-card author-box" style={{ gridColumn:'1 / 2', display:'flex', alignItems:'center', gap:12 }}>
          {article.author?.avatar_url ? (
            <img src={article.author.avatar_url} alt="author avatar" className="avatar" loading="lazy" decoding="async" style={{ width:48, height:48 }} />
          ) : (
            <span className="avatar-fallback" style={{ width:48, height:48, fontSize:'.9rem' }}>{(article.author?.name || 'U').slice(0,1).toUpperCase()}</span>
          )}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <strong>{article.author?.name || 'Author'}</strong>
              <a href={`/author/${article.author_id}`} className="btn btn-link">View profile</a>
              <button className="btn" onClick={follow}>Follow</button>
            </div>
            <div className="muted" style={{ fontSize:'.9rem' }}>Posted on {new Date(article.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        {/* Divider only under content column */}
        <hr className="article-divider" style={{ gridColumn:'1 / 2', margin:'8px 0 12px' }} />
        {/* Centered actions, aligned to content column */}
        <div className="actions-wrap" style={{ gridColumn:'1 / 2', marginTop: 8, marginBottom: 8 }}>
          <ActionsBar />
        </div>
      </div>
      {showComments && (
        <Suspense fallback={<div className="section-card"><div className="skeleton-line w-80" /><div className="skeleton-line w-60" /></div>}>
          <Comments articleId={article.id} onCountChange={setCommentCount} refreshKey={commentsKey} focusInputKey={focusCommentKey} />
        </Suspense>
      )}
      {(relatedLoading || related.length > 0) && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>You might also like</h3>
          {relatedLoading ? (
            <div className="grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="card skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid">
              {related.map((a, idx) => (
                <ArticleCard key={a.id} article={a} index={idx} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
