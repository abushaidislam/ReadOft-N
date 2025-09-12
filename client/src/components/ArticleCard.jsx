import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function ArticleCard({ article, index = 0 }) {
  const created = article.created_at ? new Date(article.created_at).toLocaleDateString() : ''
  const excerpt = (article.content || '').replace(/[#*_>`]/g, '').slice(0, 160)
  const { request, auth, ui } = useAuth()
  const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
  const readingTime = Number.isFinite(article.reading_time) && article.reading_time > 0
    ? article.reading_time
    : Math.max(1, Math.round(sanitize(article.content).trim().split(/\s+/).filter(Boolean).length / 200))
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
      } catch (e) { if (import.meta.env.DEV) console.debug('article card status load failed', e) }
    }
    fetchStatus().catch(() => {})
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
    } catch (e) { if (import.meta.env.DEV) console.debug('article like failed', e) } finally { setBusy(false) }
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
    } catch (e) { if (import.meta.env.DEV) console.debug('toggle save failed', e) } finally { setBusy(false) }
  }
  const share = async () => {
    try {
      const link = article.slug ? `${location.origin}/a/${article.slug}` : `${location.origin}/article/${article.id}`
      if (navigator.share) {
        await navigator.share({ title: article.title, text: `${article.title} — ${readingTime} min read`, url: link })
      } else {
        await navigator.clipboard.writeText(link)
        ui?.notify?.('Link copied', 'success')
      }
    } catch (e) { if (import.meta.env.DEV) console.debug('share failed', e) }
  }
  return (
    <article className="card card-animated" style={{ animationDelay: `${(index % 12) * 30}ms` }}>
      {article.thumbnail_url ? (
        <img src={article.thumbnail_url} alt="thumbnail" className="thumb" loading="lazy" decoding="async" />
      ) : null}
      <h3 className="card-title">
        <Link to={article.slug ? `/a/${article.slug}` : `/article/${article.id}`}>{article.title}</Link>
      </h3>
      <p className="muted">{created} • {readingTime} min read • {likeCount} likes • {(article.views_count ?? 0)} reads</p>
      <p className="line-clamp">{excerpt}{excerpt.length >= 160 ? '…' : ''}</p>
      <div className="card-actions">
        <button className={`icon-btn ${liked ? 'active' : ''}`} onClick={like} disabled={busy || liked}>
          {liked ? '❤️ Liked' : '🤍 Like'}
        </button>
        <button className={`icon-btn ${saved ? 'active' : ''}`} onClick={toggleSave} disabled={busy}>
          {saved ? '🔖 Saved' : '📎 Save'}
        </button>
        <button className="icon-btn" onClick={share}>
          🔗 Share
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
        {(article.tags || []).slice(0, 3).map((t) => (
          <Link className="chip" key={`tag-${t}`} to={`/tag/${encodeURIComponent(t)}`}>#{t}</Link>
        ))}
      </div>
    </article>
  )
}
