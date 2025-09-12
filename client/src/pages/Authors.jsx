import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Authors() {
  const { request, auth } = useAuth()

  // Search
  const [q, setQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const debounceRef = useRef(null)

  // Followed authors (if logged in)
  const [followed, setFollowed] = useState([])
  const [followedLoading, setFollowedLoading] = useState(false)

  // Top authors
  const [top, setTop] = useState([])
  const [topLoading, setTopLoading] = useState(false)

  // All authors
  const [items, setItems] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-created_at') // name | -created_at
  const [allLoading, setAllLoading] = useState(true)
  const [error, setError] = useState('')

  // Helpers
  const doSearch = useCallback(async (term) => {
    try {
      setSearchBusy(true)
      const data = await request(`/authors/search?q=${encodeURIComponent(term)}&limit=12`, { noGlobalLoading: true })
      setSearchResults(Array.isArray(data) ? data : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearchBusy(false)
    }
  }, [request])

  const loadFollowed = useCallback(async () => {
    if (!auth.user) { setFollowed([]); return }
    setFollowedLoading(true)
    try {
      const data = await request('/follows/me', { noGlobalLoading: true })
      setFollowed(Array.isArray(data) ? data : [])
    } catch { setFollowed([]) } finally { setFollowedLoading(false) }
  }, [auth.user, request])

  const loadTop = useCallback(async () => {
    setTopLoading(true)
    try {
      const data = await request('/authors/top?limit=12', { noGlobalLoading: true })
      setTop(Array.isArray(data) ? data : [])
    } catch { setTop([]) } finally { setTopLoading(false) }
  }, [request])

  const loadAll = useCallback(async () => {
    setAllLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', sort, with_followers: '1' })
      const data = await request(`/authors/list?${params.toString()}`, { noGlobalLoading: true })
      setItems(Array.isArray(data?.items) ? data.items : [])
      setPageInfo(data?.pageInfo || null)
    } catch (e) {
      setError(e?.message || 'Failed to load authors')
    } finally { setAllLoading(false) }
  }, [page, sort, request])

  // Effects
  useEffect(() => { loadTop().catch(()=>{}); loadFollowed().catch(()=>{}) }, [loadTop, loadFollowed])
  useEffect(() => { setPage(1) }, [sort])
  useEffect(() => { loadAll().catch(()=>{}) }, [page, sort, loadAll])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(() => { doSearch(q).catch(()=>{}) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, doSearch])

  const grid = useMemo(() => ({ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }), [])

  const followingIds = useMemo(() => new Set((followed || []).map((u) => u.id)), [followed])

  const toggleFollow = useCallback(async (e, authorId, isFollowing) => {
    try {
      e?.preventDefault?.(); e?.stopPropagation?.()
      if (!auth.user) return
      if (isFollowing) await request(`/follows/${authorId}`, { method: 'DELETE', noGlobalLoading: true })
      else await request(`/follows/${authorId}`, { method: 'POST', noGlobalLoading: true })
      loadFollowed().catch(()=>{})
    } catch (err) { if (import.meta.env.DEV) console.debug('toggleFollow failed', err) }
  }, [auth.user, request, loadFollowed])

  const AuthorCard = ({ u }) => {
    const isMe = auth.user && auth.user.id === u.id
    const isFollowing = auth.user ? followingIds.has(u.id) : false
    const latest = u.latest_article
    const articleHref = latest ? (latest.slug ? `/a/${latest.slug}` : `/article/${latest.id}`) : null
    return (
      <div className="card author-card" style={{ display:'block', padding:16 }}>
        {/* Avatar + name */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative' }}>
            {u.avatar_url ? (
              <img src={u.avatar_url} alt={u.name} width={80} height={80} style={{ borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)' }} loading="lazy" decoding="async" />
            ) : (
              <span className="avatar-fallback" style={{ width:80, height:80 }}>{(u.name || 'A').slice(0,1).toUpperCase()}</span>
            )}
            {/* small status dot */}
            <span style={{ position:'absolute', right:-2, bottom:-2, width:14, height:14, background:'var(--primary)', borderRadius:'50%', border:'2px solid var(--bg)' }}></span>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:600, fontSize:'1.05rem' }}>{u.name || 'Author'}</div>
            {/* Stats: followers + posts (show only if present) */}
            {((u.follower_count != null) || (u.posts_count != null)) && (
              <div className="muted" style={{ display:'flex', gap:14, justifyContent:'center', marginTop:6, fontSize:'.9rem' }}>
                {u.follower_count != null && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>
                    {u.follower_count.toLocaleString?.() || u.follower_count}
                  </span>
                )}
                {u.posts_count != null && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z"></path></svg>
                    {u.posts_count.toLocaleString?.() || u.posts_count} articles
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="muted" style={{ textAlign:'center', marginTop:10 }}>
          {String(u.bio || 'No bio provided.').slice(0, 140)}
        </div>

        {/* Categories from latest article */}
        {latest?.categories?.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:10 }}>
            {latest.categories.slice(0, 3).map((c, i) => {
              const label = typeof c === 'string' ? c.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : String(c)
              return (
                <span
                  key={i}
                  className="chip"
                  style={{ fontSize: '.85rem', padding: '6px 10px', borderRadius: 999, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {label}
                </span>
              )
            })}
          </div>
        )}

        {/* Latest article */}
        {latest && (
          <div style={{ marginTop:14 }}>
            <div className="muted" style={{ fontSize:'.85rem', letterSpacing:'.04em', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 5h18v2H3V5zm0 4h18v10H3V9zm2 2v6h14v-6H5z"></path></svg>
              LATEST ARTICLE
            </div>
            {articleHref ? (
              <Link to={articleHref} className="link" style={{ display:'block', marginTop:6, fontWeight:600 }}>
                {latest.title || 'Untitled'}
              </Link>
            ) : (
              <div style={{ marginTop:6, fontWeight:600 }}>{latest.title || 'Untitled'}</div>
            )}
            <div className="muted" style={{ display:'flex', gap:14, alignItems:'center', marginTop:6, fontSize:'.9rem' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 6a9 9 0 100 18 9 9 0 000-18zm.5 4H11v5l4.25 2.52.75-1.23-3.5-2.04V10z"></path></svg>
                {new Date(latest.created_at).toLocaleDateString?.()}
              </span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 6c-4.97 0-9 3.58-9 8s4.03 8 9 8 9-3.58 9-8-4.03-8-9-8zm0 14c-3.87 0-7-2.91-7-6s3.13-6 7-6 7 2.91 7 6-3.13 6-7 6zm0-10c-2.76 0-5 1.79-5 4s2.24 4 5 4 5-1.79 5-4-2.24-4-5-4z"></path></svg>
                {(latest.views_count ?? 0).toLocaleString?.() || (latest.views_count ?? 0)} reads
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:16 }}>
          {auth.user && !isMe ? (
            <button className="btn" onClick={(e) => toggleFollow(e, u.id, isFollowing)}>
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          ) : (
            <span />
          )}
          <Link className="btn btn-primary" to={`/author/${u.id}`}>View Profile</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <div className="page-head" style={{ marginBottom: 12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <h2 style={{ margin: 0 }}>Authors</h2>
        <input
          className="input"
          placeholder="Search authors by name…"
          value={q}
          onChange={(e)=> setQ(e.target.value)}
          style={{ width: 320, maxWidth: '50%' }}
        />
      </div>

      {/* Search results */}
      {q.trim() && (
        <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h3 style={{ margin:0 }}>Search results</h3>
          </div>
          {searchBusy ? (
            <div style={grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="card skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="muted">No authors found</div>
          ) : (
            <div style={grid}>
              {searchResults.map((u) => <AuthorCard key={u.id} u={u} />)}
            </div>
          )}
        </div>
      )}

      {/* Followed authors */}
      {auth.user && !q.trim() && (
        <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="page-head" style={{ marginBottom: 8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ margin:0 }}>Followed authors</h3>
            <div className="muted" style={{ fontSize:'.9rem' }}>{followed.length} total</div>
          </div>
          {followedLoading ? (
            <div style={grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="card skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ))}
            </div>
          ) : followed.length === 0 ? (
            <div className="muted">You are not following any authors yet.</div>
          ) : (
            <div style={grid}>
              {followed.map((u) => <AuthorCard key={u.id} u={u} />)}
            </div>
          )}
        </div>
      )}

      {/* Top authors */}
      {!q.trim() && (
        <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="page-head" style={{ marginBottom: 8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ margin:0 }}>Top authors</h3>
            <div className="muted" style={{ fontSize:'.9rem' }}>{top.length} shown</div>
          </div>
          {topLoading ? (
            <div style={grid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="card skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ))}
            </div>
          ) : top.length === 0 ? (
            <div className="muted">No authors yet.</div>
          ) : (
            <div style={grid}>
              {top.map((u) => <AuthorCard key={u.id} u={u} />)}
            </div>
          )}
        </div>
      )}

      {/* All authors */}
      {!q.trim() && (
        <div className="section-card" style={{ padding: 16 }}>
          <div className="page-head" style={{ marginBottom: 12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <h3 style={{ margin:0 }}>All authors</h3>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span className="muted">Sort</span>
              <select className="btn" value={sort} onChange={(e)=>{ setPage(1); setSort(e.target.value) }} style={{ padding:'6px 8px' }}>
                <option value='-created_at'>Newest</option>
                <option value='name'>A–Z</option>
              </select>
            </div>
          </div>
          {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
          {allLoading ? (
            <div style={grid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div className="card skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={grid}>
                {items.map((u) => <AuthorCard key={u.id} u={u} />)}
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
                <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span className="muted">Page {pageInfo?.page || page} / {pageInfo?.totalPages || '?'}</span>
                <button className="btn" disabled={pageInfo && page >= pageInfo.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
