import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

const FALLBACK_AVATAR = 'https://placehold.co/120x120?text=Avatar'
const THEME_OPTIONS = [
  { value: 'light', label: 'Light Mode', description: 'Bright and crisp look for daytime reading.' },
  { value: 'dark', label: 'Dark Mode', description: 'Dimmed contrast for low-light comfort.' },
  { value: 'system', label: 'System Default', description: 'Automatically follows your device preference.' },
]
const RECENT_READ_LIMIT = 6

export default function Profile() {
  const { request, auth, setAuth } = useAuth()
  const [follows, setFollows] = useState([])
  const [likes, setLikes] = useState([])
  const [reads, setReads] = useState([])
  const [followers, setFollowers] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [me, setMe] = useState(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pwd, setPwd] = useState({ current: '', next: '' })
  const [applyStatus, setApplyStatus] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [themePref, setThemePref] = useState(() => getInitialThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(getInitialThemePreference()))
  const fileRef = useRef(null)

  function base64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  async function enablePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push not supported in this browser')
        return
      }
      let perm = typeof Notification !== 'undefined' ? Notification.permission : 'default'
      if (perm === 'default') {
        perm = await Notification.requestPermission()
        setPushPermission(perm)
      }
      if (perm !== 'granted') {
        alert('Please allow notifications to enable push')
        return
      }
      const reg = await navigator.serviceWorker.ready
      let keyResp
      try { keyResp = await request('/push/public-key', { noGlobalLoading: true }) } catch (err) { if (import.meta.env.DEV) console.debug('public-key fetch failed', err); keyResp = null }
      const publicKey = keyResp?.publicKey
      if (!publicKey) { alert('Push keys not configured on server'); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) })
      const payload = sub?.toJSON ? sub.toJSON() : sub
      await request('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: payload }), noGlobalLoading: true })
      setPushEnabled(true)
      alert('Push enabled')
    } catch (e) {
      if (import.meta.env.DEV) console.debug('enablePush failed', e)
      alert(e?.message || 'Failed to enable push')
    }
  }

  async function disablePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) { setPushEnabled(false); return }
      const endpoint = sub.endpoint
      try { await request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }), noGlobalLoading: true }) } catch (err) { if (import.meta.env.DEV) console.debug('server unsubscribe notify failed', err) }
      await sub.unsubscribe()
      setPushEnabled(false)
      alert('Push disabled')
    } catch (e) { if (import.meta.env.DEV) console.debug('disablePush failed', e) }
  }

  useEffect(() => {
    request('/me').then((m) => { setMe(m); setName(m.name || ''); setBio(m.bio || '') }).catch(console.error)
    request('/follows/me').then(setFollows).catch(console.error)
    request('/likes/me').then(setLikes).catch(console.error)
    request('/bookmarks/me').then(setBookmarks).catch(() => {})
    request('/reads/me').then(setReads).catch(() => {})
    if (auth.user?.role === 'author' || auth.user?.role === 'admin') {
      request('/follows/followers/me').then(setFollowers).catch(() => {})
    }
    request('/me/apply-author/status', { noGlobalLoading: true }).then(setApplyStatus).catch(() => {})
    ;(async () => {
      try {
        setPushPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default')
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          setPushEnabled(!!sub)
        }
      } catch (e) { if (import.meta.env.DEV) console.debug('push status check failed', e) }
    })()
  }, [request, auth.user?.role])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}
    const handler = (event) => {
      const pref = event.detail?.preference
      const resolved = event.detail?.resolved ?? resolveTheme(pref)
      if (pref) {
        setThemePref(pref)
        setResolvedTheme(resolved)
      }
    }
    window.addEventListener('theme-preference-change', handler)
    return () => window.removeEventListener('theme-preference-change', handler)
  }, [])

  const analytics = useMemo(() => computeAnalytics(reads), [reads])
  const categoryStats = useMemo(() => computeCategoryStats(reads), [reads])
  const mostLikedCategory = useMemo(() => computeMostLikedCategory(likes), [likes])

  const handleThemeChange = (pref) => {
    const resolved = resolveTheme(pref)
    setThemePref(pref)
    setResolvedTheme(resolved)
    try { localStorage.setItem('theme', pref) } catch {}
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.setAttribute('data-theme', resolved)
      if (resolved === 'dark') root.classList.add('dark')
      else root.classList.remove('dark')
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('theme-preference-change', { detail: { preference: pref, resolved } }))
    }
  }

  return (
    <div className="container page profile-page">
      <section className="section-card profile-hero">
        <div className="profile-hero-main">
          <div className="profile-avatar-wrap">
            <img className="profile-avatar" src={me?.avatar_url || FALLBACK_AVATAR} alt="Avatar" loading="lazy" decoding="async" />
            <input
              hidden
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                setError(''); setSuccess('')
                const file = e.target.files?.[0]
                if (!file) return
                const fd = new FormData()
                fd.append('file', file)
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/avatar`, { method: 'POST', headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {}, body: fd })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) { setError(data.message || 'Avatar upload failed'); return }
                const updated = await request('/me', { method: 'PUT', body: JSON.stringify({ avatar_url: data.url, avatar_path: data.path }) })
                setMe(updated)
                setAuth({ ...auth, user: { ...auth.user, name: updated.name, avatar_url: updated.avatar_url } })
                setSuccess('Avatar updated')
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Change Avatar</button>
          </div>
          <div className="profile-hero-body">
            <h1 className="profile-name">{me?.name || 'Add your name'}</h1>
            <div className="profile-handle">{formatHandle(me?.email)}</div>
            <p className="profile-bio">{bio || 'Write a short bio to personalise your profile.'}</p>
            <div className="profile-hero-actions">
              {auth.user?.id && <Link className="btn" to={`/author/${auth.user.id}`}>View Public Profile</Link>}
              {auth.user?.role === 'reader' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await request('/me/apply-author', { method: 'POST' })
                      setApplyStatus({ requestedAt: new Date().toISOString() })
                      setSuccess('Application submitted')
                    } catch (e) {
                      if (import.meta.env.DEV) console.debug('apply-author failed', e)
                    }
                  }}
                  disabled={!!applyStatus?.requestedAt}
                >
                  Apply for author
                </button>
              )}
              {applyStatus?.requestedAt && (
                <span className="profile-apply-status">Requested {formatRelativeTime(applyStatus.requestedAt)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="profile-connections">
          {[{ label: 'Following', value: follows.length }, { label: 'Followers', value: followers.length }, { label: 'Likes', value: likes.length }, { label: 'Bookmarks', value: bookmarks.length }].map((stat) => (
            <div className="profile-connection-pill" key={stat.label}>
              <div className="profile-connection-value">{stat.value}</div>
              <span className="profile-connection-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <h2>Reading Statistics</h2>
        </div>
        <div className="profile-stat-grid">
          <div className="profile-stat-card">
            <div className="profile-stat-icon">TAG</div>
            <div>
              <div className="profile-stat-label">Total Reading Time</div>
              <div className="profile-stat-value">{formatLongDuration(analytics.totalSecs)}</div>
              <div className="profile-stat-helper">Tracked over the last {analytics.last7.length} days</div>
            </div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-icon">TAG</div>
            <div>
              <div className="profile-stat-label">Articles Read</div>
              <div className="profile-stat-value">{analytics.uniqueArticles}</div>
              <div className="profile-stat-helper">Including rereads in progress</div>
            </div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-icon">TAG</div>
            <div>
              <div className="profile-stat-label">Most Liked Category</div>
              <div className="profile-stat-value">{mostLikedCategory || 'None'}</div>
              <div className="profile-stat-helper">Based on your liked and saved articles</div>
            </div>
          </div>
        </div>
        <div className="profile-category">
          <h3>Time Spent by Category</h3>
          {categoryStats.entries.length === 0 ? (
            <p className="profile-empty">Start reading to see your category breakdown.</p>
          ) : (
            <ul className="profile-category-list">
              {categoryStats.entries.map((entry) => (
                <li className="profile-category-item" key={entry.name}>
                  <div className="profile-category-label">{entry.name}</div>
                  <div className="profile-category-bar">
                    <div className="profile-category-fill" style={{ width: `${entry.pct}%` }} />
                  </div>
                  <div className="profile-category-meta">
                    <span>{formatLongDuration(entry.secs)}</span>
                    <span>{entry.share}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <h2>Recently Read Articles</h2>
        </div>
        {reads.length === 0 ? (
          <p className="profile-empty">No reading history yet. Explore articles to start building your feed.</p>
        ) : (
          <div className="profile-recent-grid">
            {reads.slice(0, RECENT_READ_LIMIT).map((r, idx) => {
              const article = r.article || {}
              const href = article.slug ? `/a/${article.slug}` : `/article/${article.id}`
              return (
                <div className="profile-recent-card" key={`${article.id || idx}-${r.last_read_at}`}>
                  <div className="profile-recent-thumb">
                    {article.thumbnail_url ? (
                      <img src={article.thumbnail_url} alt="thumbnail" loading="lazy" decoding="async" />
                    ) : (
                      <div className="thumb-sm thumb-empty" style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                  <div className="profile-recent-body">
                    <Link className="profile-recent-title" to={href}>{article.title || 'Untitled article'}</Link>
                    <div className="profile-recent-meta">Read {formatRelativeTime(r.last_read_at)} - {formatDuration(r.duration_seconds)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="profile-two-column">
        <section className="section-card profile-account">
          <div className="section-heading">
            <h3>Account Information</h3>
          </div>
          <div className="profile-form-grid">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
            <label>
              <span>Email</span>
              <input value={me?.email || ''} disabled />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <span>Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell readers about yourself" />
          </label>
          <div className="profile-form-actions">
            <button className="btn btn-primary" onClick={async () => {
              setError(''); setSuccess('')
              try {
                const updated = await request('/me', { method: 'PUT', body: JSON.stringify({ name, bio }) })
                setMe(updated)
                setAuth({ ...auth, user: { ...auth.user, name: updated.name } })
                setSuccess('Profile saved')
              } catch (e) { setError(e.message || 'Failed to update profile') }
            }}>Save Changes</button>
            {success && <span className="profile-success">{success}</span>}
            {error && <span className="profile-error">{error}</span>}
          </div>
          <button className="profile-link" onClick={() => setShowPasswordForm((v) => !v)}>
            {showPasswordForm ? 'Hide password form' : 'Change password'}
          </button>
          {showPasswordForm && (
            <div className="profile-password-form">
              <input placeholder="Current password" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
              <input placeholder="New password" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              <div className="profile-form-actions" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={async () => {
                  setError(''); setSuccess('')
                  try {
                    const resp = await request('/me/password', { method: 'PUT', body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }) })
                    if (resp?.token) setAuth({ token: resp.token, user: auth.user })
                    setPwd({ current: '', next: '' })
                    setSuccess('Password changed')
                  } catch (e) { setError(e.message || 'Failed to update password') }
                }}>Update Password</button>
              </div>
            </div>
          )}
        </section>

        <section className="section-card profile-preferences">
          <div className="section-heading">
            <h3>Preferences</h3>
          </div>
          <div>
            <span className="profile-label">Theme</span>
            <div className="profile-radio-group">
              {THEME_OPTIONS.map((opt) => (
                <label key={opt.value} className="profile-radio">
                  <input type="radio" name="theme" value={opt.value} checked={themePref === opt.value} onChange={() => handleThemeChange(opt.value)} />
                  <div>
                    <div className="profile-radio-title">{opt.label}</div>
                    <div className="profile-radio-desc">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="muted" style={{ fontSize: '.85rem', marginTop: 8 }}>Currently: {resolvedTheme}</div>
          </div>
          <div style={{ marginTop: 24 }}>
            <span className="profile-label">Push Notifications</span>
            <div className="muted" style={{ marginBottom: 12 }}>Enable web push notifications for new posts and updates.</div>
            <div className="profile-preference-actions">
              <button className="btn btn-primary" onClick={enablePush} disabled={pushEnabled}>Enable</button>
              <button className="btn" onClick={disablePush} disabled={!pushEnabled}>Disable</button>
            </div>
            <div className="chips" style={{ marginTop: 4 }}>
              <span className="chip">Permission: {pushPermission}</span>
              <span className="chip">Status: {pushEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="muted" style={{ fontSize: '.8rem', marginTop: 8 }}>Note: Requires browser support and permission. iOS may require Add to Home Screen for full support.</div>
          </div>
        </section>
      </div>

      <section className="section-card">
        <div className="section-heading">
          <h3>Followed Authors</h3>
        </div>
        {follows.length === 0 ? (
          <p className="profile-empty">You are not following any authors yet.</p>
        ) : (
          <div className="chips">
            {follows.map((a) => (
              <Link to={`/author/${a.id}`} className="chip" key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {a.avatar_url ? (
                  <img src={a.avatar_url} width={24} height={24} style={{ borderRadius: '50%' }} loading="lazy" decoding="async" />
                ) : (
                  <span className="avatar-fallback" style={{ width: 24, height: 24 }}>{(a.name || 'A').slice(0, 1).toUpperCase()}</span>
                )}
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {(auth.user?.role === 'author' || auth.user?.role === 'admin') && (
        <section className="section-card">
          <div className="section-heading">
            <h3>Your Followers</h3>
          </div>
          {followers.length === 0 ? (
            <p className="profile-empty">No followers yet. Share your articles to grow your audience.</p>
          ) : (
            <div className="chips">
              {followers.map((u) => (
                <span key={u.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <img src={u.avatar_url || 'https://placehold.co/24x24'} width={24} height={24} style={{ borderRadius: '50%' }} loading="lazy" decoding="async" />
                  {u.name}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="profile-library-grid">
        <section className="section-card">
          <h3>Articles You Liked</h3>
          {likes.length === 0 ? (
            <p className="profile-empty">Save favourites as you browse to build this list.</p>
          ) : (
            <ul className="media-list">
              {likes.map((a) => (
                <li key={a.id} className="media-item">
                  {a.thumbnail_url ? <img className="thumb-sm" src={a.thumbnail_url} alt="thumb" loading="lazy" decoding="async" /> : <div className="thumb-sm thumb-empty" />}
                  <div className="media-body">
                    <Link to={a.slug ? `/a/${a.slug}` : `/article/${a.id}`}>{a.title}</Link>
                    {a.created_at && <div className="muted" style={{ fontSize: '.8rem' }}>{new Date(a.created_at).toLocaleDateString()}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="section-card">
          <h3>Bookmarks</h3>
          {bookmarks.length === 0 ? (
            <p className="profile-empty">Save articles to revisit them later.</p>
          ) : (
            <ul className="media-list">
              {bookmarks.map((a) => (
                <li key={a.id} className="media-item">
                  {a.thumbnail_url ? <img className="thumb-sm" src={a.thumbnail_url} alt="thumb" loading="lazy" decoding="async" /> : <div className="thumb-sm thumb-empty" />}
                  <div className="media-body">
                    <Link to={a.slug ? `/a/${a.slug}` : `/article/${a.id}`}>{a.title}</Link>
                    {a.created_at && <div className="muted" style={{ fontSize: '.8rem' }}>{new Date(a.created_at).toLocaleDateString()}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {reads.length > 0 && (
        <section className="section-card profile-reading-history">
          <h3>Reading History</h3>
          <ul className="list-clean">
            {reads.map((r, idx) => (
              <li key={idx}>
                <Link to={r.article?.slug ? `/a/${r.article.slug}` : `/article/${r.article?.id}`}>{r.article?.title || 'Unknown article'}</Link> - {formatDuration(r.duration_seconds)} - {new Date(r.last_read_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function computeAnalytics(reads) {
  const totalSecs = reads.reduce((sum, r) => sum + (parseInt(r.duration_seconds) || 0), 0)
  const byDay = new Map()
  const byArticle = new Map()
  for (const r of reads) {
    const duration = parseInt(r.duration_seconds) || 0
    if (!duration) continue
    const date = new Date(r.last_read_at)
    const key = Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
    if (key) byDay.set(key, (byDay.get(key) || 0) + duration)
    const articleId = r.article?.id || `unknown-${key || Math.random()}`
    const prev = byArticle.get(articleId) || { id: articleId, title: r.article?.title, secs: 0 }
    prev.secs += duration
    byArticle.set(articleId, prev)
  }
  const last7 = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const secs = byDay.get(key) || 0
    last7.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), secs })
  }
  const uniqueArticles = byArticle.size
  return { totalSecs, last7, uniqueArticles }
}

function computeCategoryStats(reads) {
  const totals = new Map()
  let maxSecs = 0
  let total = 0
  for (const r of reads) {
    const duration = parseInt(r.duration_seconds) || 0
    if (!duration) continue
    const categories = Array.isArray(r.article?.categories) && r.article.categories.length ? r.article.categories : ['Uncategorised']
    const share = duration / categories.length
    for (const cat of categories.slice(0, 3)) {
      const next = (totals.get(cat) || 0) + share
      totals.set(cat, next)
      maxSecs = Math.max(maxSecs, next)
    }
    total += duration
  }
  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).map(([name, secs]) => ({
    name,
    secs,
    pct: maxSecs ? Math.max(6, Math.round((secs / maxSecs) * 100)) : 0,
    share: total ? Math.round((secs / total) * 100) : 0,
  }))
  return { entries, totalSecs: total }
}

function computeMostLikedCategory(likes) {
  const counts = new Map()
  for (const article of likes) {
    const categories = Array.isArray(article?.categories) ? article.categories : []
    if (categories.length === 0) {
      counts.set('Uncategorised', (counts.get('Uncategorised') || 0) + 1)
    } else {
      for (const cat of categories.slice(0, 3)) {
        counts.set(cat, (counts.get(cat) || 0) + 1)
      }
    }
  }
  let best = null
  let max = 0
  for (const [cat, value] of counts.entries()) {
    if (value > max) { max = value; best = cat }
  }
  return best
}

function formatDuration(secs) {
  secs = Math.round(secs || 0)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

function formatLongDuration(secs) {
  secs = Math.round(secs || 0)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m`
  return `${secs}s`
}

function formatRelativeTime(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return 'just now'
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function formatHandle(email) {
  if (!email) return ''
  return `@${email.split('@')[0]}`
}

function getInitialThemePreference() {
  if (typeof window === 'undefined') return 'light'
  try { return localStorage.getItem('theme') || 'light' } catch { return 'light' }
}

function resolveTheme(pref) {
  if (pref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref === 'dark' ? 'dark' : 'light'
}
