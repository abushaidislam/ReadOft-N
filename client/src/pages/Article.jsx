import { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react'
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

  useEffect(() => {
    setLoading(true)
    setArticle(null)
    setError('')
    
    const path = slug ? `/articles/slug/${slug}` : `/articles/${id}`
    request(path, { noGlobalLoading: true })
      .then((a) => {
        setArticle(a)
        articleIdRef.current = a.id
        const aid = a.id
        request(`/likes/status/${aid}`, { noGlobalLoading: true }).then((r) => setLiked(Boolean(r.liked))).catch((e) => { if (import.meta.env.DEV) console.debug('likes status failed', e) })
        request(`/bookmarks/status/${aid}`, { noGlobalLoading: true }).then((r) => setSaved(Boolean(r.saved))).catch((e) => { if (import.meta.env.DEV) console.debug('bookmarks status failed', e) })
        setRelatedLoading(true)
        request(`/articles/${aid}/related`, { noGlobalLoading: true })
          .then((r) => setRelated(Array.isArray(r) ? r : []))
          .catch(() => setRelated([]))
          .finally(() => setRelatedLoading(false))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, slug])

  useEffect(() => {
    startRef.current = Date.now()
    return () => {
      const secs = Math.round((Date.now() - startRef.current) / 1000)
      const aid = articleIdRef.current || id
      if (secs > 0 && aid) {
        request('/reads', { method: 'POST', body: JSON.stringify({ article_id: aid, duration_seconds: secs }) }).catch((e) => { if (import.meta.env.DEV) console.debug('reads post failed', e) })
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

  // Persist reader prefs
  useEffect(() => { try { localStorage.setItem('reader.fontScale', String(fontScale)) } catch (e) { if (import.meta.env.DEV) console.debug('persist fontScale failed', e) } }, [fontScale])
  useEffect(() => { try { localStorage.setItem('reader.layoutWidth', layoutWidth) } catch (e) { if (import.meta.env.DEV) console.debug('persist layoutWidth failed', e) } }, [layoutWidth])

  // Scrollspy for TOC
  useEffect(() => {
    if (!toc.length) return
    const headings = Array.from(document.querySelectorAll('.markdown h2, .markdown h3')).filter(el => el.id)
    if (!headings.length) return
    const onScroll = () => {
      const top = window.scrollY + 100
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

  if (error) return <div className="container page"><p className="error">{error}</p></div>
  if (loading || !article) return <ArticleSkeleton />

  const like = async () => {
    try {
      const resp = await request(`/likes/${article.id}`, { method: 'POST' })
      if (resp.success) {
        setArticle({ ...article, like_count: article.like_count + 1 })
        setLiked(true)
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('like failed', e) }
  }
  const follow = async () => {
    try {
      await request(`/follows/${article.author_id}`, { method: 'POST' })
    } catch (e) { if (import.meta.env.DEV) console.debug('follow failed', e) }
  }
  const toggleSave = async () => {
    try {
      if (!saved) {
        const r = await request(`/bookmarks/${article.id}`, { method: 'POST' })
        if (r?.saved) setSaved(true)
      } else {
        const r = await request(`/bookmarks/${article.id}`, { method: 'DELETE' })
        if (r && r.saved === false) setSaved(false)
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('toggle save failed', e) }
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
    } catch (e) { if (import.meta.env.DEV) console.debug('share failed', e) }
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
  // Code block renderer with Copy button
  const CodeRenderer = ({ inline, className, children, ...props }) => {
    const codeText = String(children ?? '').replace(/\n$/, '')
    if (inline) return <code className={className} {...props}>{children}</code>
    return (
      <div className="code-block">
        <button
          className="copy-btn"
          onClick={async (e) => {
            try {
              await navigator.clipboard.writeText(codeText)
              const btn = e.currentTarget
              const prev = btn.textContent
              btn.textContent = 'Copied'
              setTimeout(() => { btn.textContent = prev }, 1200)
            } catch (e) { if (import.meta.env.DEV) console.debug('copy code failed', e) }
          }}
        >Copy</button>
        <pre><code className={className} {...props}>{children}</code></pre>
      </div>
    )
  }
  return (
    <div className="container page">
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
          <p className="muted">{new Date(article.created_at).toLocaleString()} • {article.like_count} likes</p>
        </div>
        <a className="btn" href={`/author/${article.author_id}`}>View Author</a>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={like} disabled={liked}>{liked ? 'Liked' : 'Like'}</button>
        <button className="btn" onClick={follow}>Follow Author</button>
        <button className="btn" onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
        <button className="btn" onClick={share}>Share</button>
        <button className="btn" onClick={copyLink}>Copy Link</button>
        <button className="btn" onClick={async()=>{
          try {
            const reason = prompt('Why are you reporting this article?') || ''
            if (!reason.trim()) return
            await request('/reports', { method:'POST', body: JSON.stringify({ target_type:'post', target_id: article.id, reason }) })
            ui.notify('Report submitted. Thank you.', 'info')
          } catch (e) { if (import.meta.env.DEV) console.debug('report post failed', e) }
        }}>Report</button>
        {ttsSupported && (
          <div className="btn-group" style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn" onClick={startTTS} disabled={isSpeaking && !isPaused}>Listen</button>
            <button className="btn" onClick={() => (isPaused ? resumeTTS() : pauseTTS())} disabled={!isSpeaking}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn" onClick={stopTTS} disabled={!isSpeaking}>Stop</button>
            <span className="muted" style={{ fontSize: '.85rem' }}>Rate {rate.toFixed(1)}x</span>
            <button className="btn" onClick={() => setRate(r => Math.max(0.8, +(r - 0.1).toFixed(2)))}>-</button>
            <button className="btn" onClick={() => setRate(r => Math.min(1.8, +(r + 0.1).toFixed(2)))}>+</button>
          </div>
        )}
      </div>
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
        </div>
      </div>
      <div className={`markdown-layout ${layoutWidth} ${focusMode ? 'focus' : ''}`} style={{ display: 'grid', gridTemplateColumns: (!focusMode && toc.length) ? 'minmax(0,1fr) 280px' : '1fr', gap: 24 }}>
        <div className="markdown" style={{ fontSize: `${fontScale}rem`, maxWidth: layoutWidth === 'narrow' ? '740px' : 'none' }}>
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
      </div>
      <Suspense fallback={<div className="section-card"><div className="skeleton-line w-80" /><div className="skeleton-line w-60" /></div>}>
        <Comments articleId={article.id} />
      </Suspense>
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
