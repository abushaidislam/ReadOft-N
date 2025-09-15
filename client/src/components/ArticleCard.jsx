import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

// Simple className joiner
function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function ArticleCard({ article, index = 0 }) {
  const navigate = useNavigate()
  const created = article.created_at ? new Date(article.created_at).toLocaleDateString() : ''
  const { request, auth, ui } = useAuth()
  const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
  const readingTime = Number.isFinite(article.reading_time) && article.reading_time > 0
    ? article.reading_time
    : Math.max(1, Math.round(sanitize(article.content).trim().split(/\s+/).filter(Boolean).length / 200))
  const likeCount = article.like_count ?? 0
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchStatus = async () => {
      try {
        if (!auth.user) return
        const aid = article.id
        const bs = await request(`/bookmarks/status/${aid}`, { noGlobalLoading: true })
        if (!mounted) return
        if (bs) setSaved(Boolean(bs?.saved))
      } catch (e) { if (import.meta.env.DEV) console.debug('article card status load failed', e) }
    }
    fetchStatus().catch(() => {})
    return () => { mounted = false }
  }, [article.id, auth.user, request])

  const toggleSave = async () => {
    if (busy) return
    if (!auth?.user) {
      try { ui?.notify?.('Please login to save', 'error') } catch (e) { if (import.meta.env.DEV) console.debug('notify failed', e) }
      navigate('/login')
      return
    }
    try {
      setBusy(true)
      if (!saved) {
        const r = await request(`/bookmarks/${article.id}`, { method: 'POST' })
        if (r?.saved) setSaved(true)
      } else {
        const r = await request(`/bookmarks/${article.id}`, { method: 'DELETE' })
        if (r && r.saved === false) setSaved(false)
      }
    } catch (e) {
      if (import.meta.env.DEV) console.debug('toggle save failed', e)
      try { ui?.notify?.(e?.message || 'Failed to update bookmark', 'error') } catch (e2) { if (import.meta.env.DEV) console.debug('notify failed', e2) }
    } finally { setBusy(false) }
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
  // Derived UI props for the new card design
  const href = article.slug ? `/a/${article.slug}` : `/article/${article.id}`
  const coverSrc = article.thumbnail_url
  const coverAlt = article.title || 'Article cover'
  const authorName = article.author?.name || 'Author'
  const authorAvatar = article.author?.avatar_url || ''
  const category = (article.categories || [])[0] || ''
  const tags = Array.isArray(article.tags) ? article.tags : []

  return (
    <article
      className={cn(
        'article-card',
        'group relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-0 shadow-sm transition hover:shadow-md dark:border-zinc-800/70 dark:bg-zinc-900'
      )}
      style={{ animationDelay: `${(index % 12) * 30}ms` }}
    >
      {/* Cover + badges */}
      <div className="relative">
        <Link to={href} className="block">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={coverAlt}
              className={cn('h-48 md:h-56', 'w-full rounded-t-2xl object-cover transition duration-500 ease-out group-hover:brightness-105')}
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </Link>
        {category && (
          <Link to={`/category/${category}`} className="category-chip card-badge left-2 top-2">
            {category}
          </Link>
        )}
        {!!readingTime && (
          <span className="time-badge card-badge right-2 top-2">{readingTime} min</span>
        )}
      </div>

      {/* Body */}
      <div className={cn('flex flex-col gap-3', 'p-4')}>
        {/* Title */}
        <h3 className="leading-snug">
          <Link
            to={href}
            className={cn(
              'text-lg',
              'font-semibold text-zinc-950 outline-none transition hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-50 dark:hover:text-zinc-200'
            )}
          >
            {article.title}
          </Link>
        </h3>

        {/* Meta: date • readTime • likes • reads */}
        <div className={cn('meta', 'flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400', 'text-[13px]')}>
          <time className="tabular-nums">{created}</time>
          <span>•</span>
          <span>{readingTime} min read</span>
          <span>•</span>
          <span>{likeCount} likes</span>
          <span>•</span>
          <span>{(article.views_count ?? 0)} reads</span>
        </div>

        {/* Keywords line */}
        {(tags.length > 0 || (article.categories || []).length > 0) && (
          <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-200">Tags:</span>{' '}
            <span className="opacity-90">{(tags.length ? tags : (article.categories || [])).join(', ')}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSave}
            disabled={busy}
            className={cn(
              'px-3 py-1.5 text-xs action-btn',
              'inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-transparent font-medium text-zinc-800 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={share}
            className={cn(
              'px-3 py-1.5 text-xs action-btn',
              'inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-transparent font-medium text-zinc-800 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/></svg>
            Share
          </button>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between">
          <Link to={`/author/${article.author?.id || article.author_id}`} className="flex items-center gap-2">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                className={cn('rounded-full object-cover ring-2 ring-white/70 dark:ring-zinc-900/70', 'h-8 w-8')}
                loading="lazy"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-200 text-zinc-600 ring-2 ring-white/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-900/70">
                {authorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="author-name text-sm font-medium">{authorName}</span>
          </Link>
          <span />
        </div>
      </div>
    </article>
  )
}
