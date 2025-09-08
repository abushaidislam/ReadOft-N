import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import useMeta from '../utils/useMeta.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
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
      </div>
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {article.content || ''}
        </ReactMarkdown>
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
