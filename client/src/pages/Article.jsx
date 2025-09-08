import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import useMeta from '../utils/useMeta.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import Comments from '../components/Comments.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Article() {
  const { id, slug } = useParams()
  const { request, ui } = useAuth()
  const [article, setArticle] = useState(null)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState(0)
  const [related, setRelated] = useState([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [toc, setToc] = useState([])

  useEffect(() => {
    const path = slug ? `/articles/slug/${slug}` : `/articles/${id}`
    request(path)
      .then((a) => {
        setArticle(a)
        const aid = a.id
        request(`/likes/status/${aid}`).then((r) => setLiked(Boolean(r.liked))).catch(() => {})
        request(`/bookmarks/status/${aid}`).then((r) => setSaved(Boolean(r.saved))).catch(() => {})
        setRelatedLoading(true)
        request(`/articles/${aid}/related`, { noGlobalLoading: true })
          .then((r) => setRelated(Array.isArray(r) ? r : []))
          .catch(() => setRelated([]))
          .finally(() => setRelatedLoading(false))
      })
      .catch((e) => setError(e.message))
  }, [id, slug])

  useEffect(() => {
    const start = Date.now()
    return () => {
      const secs = Math.round((Date.now() - start) / 1000)
      if (secs > 0) {
        request('/reads', { method: 'POST', body: JSON.stringify({ article_id: id, duration_seconds: secs }) }).catch(() => {})
      }
    }
  }, [id])

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
  if (!article) return <div className="container page"><p>Loading...</p></div>

  const like = async () => {
    try {
      const resp = await request(`/likes/${article.id}`, { method: 'POST' })
      if (resp.success) {
        setArticle({ ...article, like_count: article.like_count + 1 })
        setLiked(true)
      }
    } catch {}
  }
  const follow = async () => {
    try {
      await request(`/follows/${article.author_id}`, { method: 'POST' })
    } catch {}
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
    } catch {}
  }
  const copyLink = async () => {
    try {
      const link = article.slug ? `${location.origin}/a/${article.slug}` : `${location.origin}/article/${article.id}`
      await navigator.clipboard.writeText(link)
      ui?.notify?.('Link copied', 'success')
    } catch {}
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
    } catch {}
  }

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
          } catch {}
        }}>Report</button>
      </div>
      <div className="markdown-layout" style={{ display: 'grid', gridTemplateColumns: toc.length ? 'minmax(0,1fr) 280px' : '1fr', gap: 'var(--space-lg)' }}>
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkSlug]} rehypePlugins={[[rehypeSanitize, mdSchema], rehypeHighlight]}>
          {article.content || ''}
          </ReactMarkdown>
        </div>
        {toc.length > 0 && (
          <aside className="toc" style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
            <div className="section-card">
              <h4 style={{marginTop:0}}>Contents</h4>
              <nav aria-label="Table of contents">
                <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                  {toc.map((h) => (
                    <li key={h.id} style={{ margin: 'var(--space-6) 0', paddingLeft: h.level === 3 ? 'var(--space-12)' : 0 }}>
                      <a href={`#${h.id}`}>{h.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        )}
      </div>
      <Comments articleId={article.id} />
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
