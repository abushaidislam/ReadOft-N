import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import Comments from '../components/Comments.jsx'

export default function Article() {
  const { id, slug } = useParams()
  const { request } = useAuth()
  const [article, setArticle] = useState(null)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const path = slug ? `/articles/slug/${slug}` : `/articles/${id}`
    request(path).then((a) => { setArticle(a); const aid = a.id; request(`/likes/status/${aid}`).then((r) => setLiked(Boolean(r.liked))).catch(() => {}); request(`/bookmarks/status/${aid}`).then((r) => setSaved(Boolean(r.saved))).catch(() => {}) }).catch((e) => setError(e.message))
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
      const scrolled = Math.min(Math.max(window.scrollY - (el.getBoundingClientRect().top + window.scrollY - 0), 0), maxScrollable)
      const pct = Math.round((scrolled / maxScrollable) * 100)
      setProgress(Number.isFinite(pct) ? pct : 0)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => { window.removeEventListener('scroll', handler); window.removeEventListener('resize', handler) }
  }, [])

  const readingMinutes = useMemo(() => {
    const text = article?.content || ''
    const words = text.trim().split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.ceil(words / 200))
  }, [article?.content])

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
    try { await request(`/follows/${article.author_id}`, { method: 'POST' }) } catch {}
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
    } catch {}
  }

  return (
    <div className="container page">
      <div className="read-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      {article.thumbnail_url && (
        <img src={article.thumbnail_url} alt="thumbnail" className="hero-thumb" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{article.title}</h1>
          <div className="muted">{readingMinutes} min read</div>
          <p className="muted">{new Date(article.created_at).toLocaleString()} • ❤ {article.like_count}</p>
        </div>
        <a className="btn" href={`/author/${article.author_id}`}>View Author</a>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={like} disabled={liked}>{liked ? 'Liked' : 'Like'}</button>
        <button className="btn" onClick={follow}>Follow Author</button>
        <button className="btn" onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
        <button className="btn" onClick={copyLink}>Copy Link</button>
      </div>
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {article.content || ''}
        </ReactMarkdown>
      </div>
      <Comments articleId={article.id} />
    </div>
  )
}
