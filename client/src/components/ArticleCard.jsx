import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function ArticleCard({ article, index = 0 }) {
  const created = article.created_at ? new Date(article.created_at).toLocaleDateString() : ''
  const excerpt = (article.content || '').replace(/[#*_>`]/g, '').slice(0, 160)
  const { request, auth } = useAuth()
  const [likeCount, setLikeCount] = useState(article.like_count ?? 0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchStatus = async () => {
      try {
        if (!auth.user) return
        const aid = article.id
        const [ls, bs] = await Promise.allSettled([
          request(`/likes/status/${aid}`, { noGlobalLoading: true }),
          request(`/bookmarks/status/${aid}`, { noGlobalLoading: true }),
        ])
        if (!mounted) return
        if (ls.status === 'fulfilled') setLiked(Boolean(ls.value?.liked))
        if (bs.status === 'fulfilled') setSaved(Boolean(bs.value?.saved))
      } catch {}
    }
    fetchStatus().catch(() => { /* ignore */ })
    return () => { mounted = false }
  }, [article.id, auth.user, request])

  const like = async () => {
    if (busy || liked) return
    try {
      setBusy(true)
      const resp = await request(`/likes/${article.id}`, { method: 'POST' })
      if (resp?.success) {
        setLiked(true)
        setLikeCount((c) => c + 1)
      }
    } catch {} finally { setBusy(false) }
  }

  const toggleSave = async () => {
    if (busy) return
    try {
      setBusy(true)
      if (!saved) {
        const r = await request(`/bookmarks/${article.id}`, { method: 'POST' })
        if (r?.saved) setSaved(true)
      } else {
        const r = await request(`/bookmarks/${article.id}`, { method: 'DELETE' })
        if (r && r.saved === false) setSaved(false)
      }
    } catch {} finally { setBusy(false) }
  }
  return (
    <article className="card card-animated" style={{ animationDelay: `${(index % 12) * 30}ms` }}>
      {article.thumbnail_url ? (
        <img src={article.thumbnail_url} alt="thumbnail" className="thumb" loading="lazy" decoding="async" />
      ) : null}
      <h3 className="card-title">
        <Link to={article.slug ? `/a/${article.slug}` : `/article/${article.id}`}>{article.title}</Link>
      </h3>
      <p className="muted">{created} • {likeCount} likes</p>
      <p className="line-clamp">{excerpt}{excerpt.length >= 160 ? '…' : ''}</p>
      <div className="card-actions">
        <button className={`icon-btn ${liked ? 'active' : ''}`} onClick={like} disabled={busy || liked}>
          {liked ? '❤️ Liked' : '🤍 Like'}
        </button>
        <button className={`icon-btn ${saved ? 'active' : ''}`} onClick={toggleSave} disabled={busy}>
          {saved ? '🔖 Saved' : '📎 Save'}
        </button>
      </div>
      <div className="chips" style={{ marginTop: 8, alignItems: 'center' }}>
        <Link className="chip author-chip" to={`/author/${article.author?.id || article.author_id}`}>
          {article.author?.avatar_url ? (
            <img className="avatar" src={article.author.avatar_url} alt={article.author?.name || 'Author'} />
          ) : (
            <span className="avatar avatar-fallback">{(article.author?.name || 'A').slice(0, 1).toUpperCase()}</span>
          )}
          <span className="author-name">{article.author?.name || 'Author'}</span>
        </Link>
        {(article.categories || []).map((c) => (
          <Link className="chip" key={c} to={`/category/${c}`}>{c}</Link>
        ))}
      </div>
    </article>
  )
}
