import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import Comments from '../components/Comments.jsx'

export default function Article() {
  const { id } = useParams()
  const { request } = useAuth()
  const [article, setArticle] = useState(null)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    request(`/articles/${id}`).then(setArticle).catch((e) => setError(e.message))
    // check like status if logged in (will 401 when not authed)
    request(`/likes/status/${id}`).then((r) => setLiked(Boolean(r.liked))).catch(() => {})
    request(`/bookmarks/status/${id}`).then((r) => setSaved(Boolean(r.saved))).catch(() => {})
  }, [id])

  useEffect(() => {
    const start = Date.now()
    return () => {
      const secs = Math.round((Date.now() - start) / 1000)
      if (secs > 0) {
        request('/reads', { method: 'POST', body: JSON.stringify({ article_id: id, duration_seconds: secs }) }).catch(() => {})
      }
    }
  }, [id])

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

  return (
    <div className="container page">
      {article.thumbnail_url && (
        <img src={article.thumbnail_url} alt="thumbnail" className="hero-thumb" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{article.title}</h1>
          <p className="muted">{new Date(article.created_at).toLocaleString()} • ❤ {article.like_count}</p>
        </div>
        <a className="btn" href={`/author/${article.author_id}`}>View Author</a>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={like} disabled={liked}>{liked ? 'Liked' : 'Like'}</button>
        <button className="btn" onClick={follow}>Follow Author</button>
        <button className="btn" onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
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
