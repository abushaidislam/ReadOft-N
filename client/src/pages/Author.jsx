import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Author() {
  const { id } = useParams()
  const { search } = useLocation()
  const { request, auth } = useAuth()
  const [summary, setSummary] = useState(null)
  const [articles, setArticles] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followed, setFollowed] = useState(false)
  const [sort, setSort] = useState('-created_at') // '-created_at' | '-like_count'
  const [tab, setTab] = useState('posts') // posts | about | dev

  // Infinite scroll state
  const [hasMore, setHasMore] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const sentinelRef = useRef(null)

  // Developer tokens (only if viewing own profile)
  const isMe = auth?.user?.id === id
  const [tokens, setTokens] = useState([])
  const [tokBusy, setTokBusy] = useState(false)
  const [newToken, setNewToken] = useState({ name: 'GPT', days: 365, scopes: { write: true, upload: true } })
  const [createdRawToken, setCreatedRawToken] = useState('')

  const loadSummary = useCallback(async () => {
    const s = await request(`/authors/${id}/summary`)
    setSummary(s)
  }, [id, request])

  const loadArticles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ author_id: id, page: '1', limit: '12', sort })
      const data = await request(`/articles?${params.toString()}`)
      setArticles(Array.isArray(data.items) ? data.items : [])
      setPageInfo(data.pageInfo || null)
      const p = data?.pageInfo?.page || 1
      const total = data?.pageInfo?.totalPages || 1
      setPage(p)
      setHasMore(p < total)
    } catch (e) {
      setError(e.message)
      setHasMore(false)
    } finally { setLoading(false) }
  }, [id, sort, request])

  const loadMore = useCallback(async () => {
    if (moreLoading || !hasMore) return
    setMoreLoading(true)
    try {
      const next = page + 1
      const params = new URLSearchParams({ author_id: id, page: String(next), limit: '12', sort })
      const data = await request(`/articles?${params.toString()}`, { noGlobalLoading: true })
      setArticles((prev) => prev.concat(Array.isArray(data?.items) ? data.items : []))
      const p = data?.pageInfo?.page || next
      const total = data?.pageInfo?.totalPages || p
      setPage(p)
      setHasMore(p < total)
    } catch (e) {
      // ignore
    } finally { setMoreLoading(false) }
  }, [id, page, sort, hasMore, moreLoading, request])

  const checkFollow = useCallback(async () => {
    try {
      const list = await request('/follows/me')
      setFollowed((list || []).some((u) => u.id === id))
    } catch (e) { if (import.meta.env.DEV) console.debug('checkFollow failed', e) }
  }, [id, request])

  const follow = useCallback(async () => {
    try { await request(`/follows/${id}`, { method: 'POST' }); setFollowed(true); loadSummary() } catch (e) { if (import.meta.env.DEV) console.debug('follow failed', e) }
  }, [id, request, loadSummary])
  const unfollow = useCallback(async () => {
    try { await request(`/follows/${id}`, { method: 'DELETE' }); setFollowed(false); loadSummary() } catch (e) { if (import.meta.env.DEV) console.debug('unfollow failed', e) }
  }, [id, request, loadSummary])

  useEffect(() => { setPage(1); setHasMore(true); loadSummary().catch(()=>{}); checkFollow().catch(()=>{}); loadArticles().catch(()=>{}) }, [id, loadSummary, checkFollow, loadArticles])

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      const e = entries[0]
      if (e.isIntersecting && tab === 'posts') loadMore().catch(()=>{})
    }, { rootMargin: '300px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, tab])

  // Developer tokens
  const loadTokens = useCallback(async () => {
    if (!isMe) return
    try {
      const list = await request('/tokens', { noGlobalLoading: true })
      setTokens(Array.isArray(list) ? list : [])
    } catch { setTokens([]) }
  }, [isMe, request])
  useEffect(() => { if (isMe && tab === 'dev') loadTokens().catch(()=>{}) }, [isMe, tab, loadTokens])
  // Read ?tab=... from URL
  useEffect(() => {
    try {
      const p = new URLSearchParams(search)
      const t = (p.get('tab') || '').toLowerCase()
      if (t === 'about') setTab('about')
      else if (t === 'dev' && isMe) setTab('dev')
      else if (t === 'posts') setTab('posts')
    } catch {}
  }, [search, isMe])
  const createToken = async () => {
    setTokBusy(true)
    try {
      const scopes = []
      if (newToken.scopes.write) scopes.push('articles:write')
      if (newToken.scopes.upload) scopes.push('media:upload')
      const res = await request('/tokens', { method: 'POST', body: JSON.stringify({ name: newToken.name || 'API token', scopes, expires_in_days: Number(newToken.days) || 365 }), noGlobalLoading: true })
      setCreatedRawToken(res?.token || '')
      await loadTokens()
    } catch (e) { /* toast comes from request */ }
    finally { setTokBusy(false) }
  }
  const revokeToken = async (tid) => {
    try { await request(`/tokens/${tid}`, { method: 'DELETE', noGlobalLoading: true }); setTokens((prev)=>prev.filter(t=>t.id!==tid)) } catch {}
  }

  if (error) return <div className="container page"><p className="error">{error}</p></div>

  const grid = useMemo(() => ({ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }), [])

  return (
    <div className="container page author-page">
      {/* Hero header */}
      <section className="author-hero">
        <div className="author-hero-bg" aria-hidden="true" />
        <div className="author-hero-inner">
          <img className="author-avatar" src={summary?.user?.avatar_url || 'https://placehold.co/160x160?text=A'} alt="avatar" loading="lazy" decoding="async" />
          <div className="author-meta">
            <h1 className="author-name">
              {summary?.user?.name || 'Author'}
              {summary?.user?.is_verified && <span className="verified-badge" title="Verified">✓</span>}
            </h1>
            <p className="author-bio">{summary?.user?.bio || '—'}</p>
            <div className="author-stats">
              <span><strong>{(summary?.counts?.followers ?? 0).toLocaleString?.() || (summary?.counts?.followers ?? 0)}</strong> Followers</span>
              <span><strong>{(summary?.counts?.posts ?? 0).toLocaleString?.() || (summary?.counts?.posts ?? 0)}</strong> Articles</span>
              <span><strong>{(summary?.counts?.likes ?? 0).toLocaleString?.() || (summary?.counts?.likes ?? 0)}</strong> Likes</span>
            </div>
          </div>
          {auth.user && auth.user.id !== id && (
            followed ? <button className="btn" onClick={unfollow}>Unfollow</button> : <button className="btn btn-primary" onClick={follow}>Follow</button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab==='posts'?'active':''}`} onClick={()=>setTab('posts')}>Posts</button>
        <button className={`tab ${tab==='about'?'active':''}`} onClick={()=>setTab('about')}>About</button>
        {isMe && <button className={`tab ${tab==='dev'?'active':''}`} onClick={()=>setTab('dev')}>Developer</button>}
        <div className="tab-spacer" />
        <div className="sort-wrap">
          <span className="muted">Sort</span>
          <select className="btn" value={sort} onChange={(e)=>{ setPage(1); setHasMore(true); setArticles([]); setSort(e.target.value); loadArticles().catch(()=>{}) }} style={{ padding:'6px 8px' }}>
            <option value='-created_at'>Latest</option>
            <option value='-like_count'>Most Liked</option>
          </select>
        </div>
      </div>

      {/* Posts tab */}
      {tab==='posts' && (
        <section className="section-card" style={{ padding:16 }}>
          {loading ? (
            <div style={grid}>
              {Array.from({ length: 6 }).map((_, i) => (
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
                {articles.map((a) => <ArticleCard article={a} key={a.id} />)}
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginTop: 16 }}>
                {moreLoading && <div className="muted">Loading more…</div>}
                {!moreLoading && hasMore && <button className="btn" onClick={()=>loadMore()}>Load more</button>}
              </div>
              <div ref={sentinelRef} style={{ height: 1 }} />
            </>
          )}
        </section>
      )}

      {/* About tab */}
      {tab==='about' && (
        <section className="section-card" style={{ padding:16 }}>
          <h3 style={{marginTop:0}}>About {summary?.user?.name?.split(' ')?.[0] || 'author'}</h3>
          <p className="muted" style={{whiteSpace:'pre-wrap'}}>{summary?.user?.bio || 'No bio added yet.'}</p>
          <div className="muted" style={{marginTop:8}}>Joined {summary?.user?.created_at ? new Date(summary.user.created_at).toLocaleDateString() : '—'}</div>
        </section>
      )}

      {/* Developer tab (PAT management) */}
      {tab==='dev' && isMe && (
        <section className="section-card" style={{ padding:16 }}>
          <h3 style={{marginTop:0}}>API Tokens</h3>
          <p className="muted">Create Personal Access Tokens to publish from external tools (Custom GPT, scripts, etc.).</p>
          <details className="help-box" style={{ margin:'8px 0 12px' }}>
            <summary style={{ cursor:'pointer', fontWeight:600 }}>কীভাবে ব্যবহার করবেন (বাংলা গাইড)</summary>
            <div style={{ marginTop:8 }}>
              <ol style={{ margin:'8px 0', paddingLeft:'1.25rem' }}>
                <li>উপরের ফর্ম থেকে একটি টোকেন তৈরি করুন (নাম, মেয়াদ, স্কোপ)।</li>
                <li>তৈরির পর যে <code>pat_...</code> টোকেন দেখাবে সেটা কপি করে নিরাপদে রাখুন।</li>
                <li>Custom GPT বা স্ক্রিপ্ট থেকে কল করার সময় হেডারে <code>x-auth-token: pat_...</code> পাঠান।</li>
                <li>Custom GPT Actions-এ Authentication হিসেবে “API Key” বেছে নিন এবং key-এর নাম দিন <code>x-auth-token</code>। Localhost কাজ করবে না—ডেপ্লয়ড API URL দিন।</li>
              </ol>
              <div className="muted" style={{ margin:'8px 0 4px', fontWeight:600 }}>curl উদাহরণ</div>
              <pre className="code" style={{ whiteSpace:'pre-wrap', background:'#0f1320', padding:12, border:'1px solid var(--border)', borderRadius:8 }}>
{`# নতুন আর্টিকেল তৈরি
curl -X POST https://your-domain/api/articles \
  -H "x-auth-token: pat_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API থেকে লেখা",
    "content": "Markdown body...",
    "status": "pending",
    "tags": ["ai"],
    "categories": ["tech"]
  }'

# কনটেন্ট আপডেট
curl -X PUT https://your-domain/api/articles/<ARTICLE_ID> \
  -H "x-auth-token: pat_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "content": "Updated body" }'`}
              </pre>
              <div className="muted" style={{ marginTop:8 }}>401 বা Invalid token পেলে: টোকেন মেয়াদোত্তীর্ণ/ভুল কিনা দেখুন, এবং ডোমেইন সঠিকভাবে সেট আছে কি না নিশ্চিত করুন।</div>
            </div>
          </details>
          <div className="token-create" style={{ display:'grid', gridTemplateColumns:'1fr 160px 1fr auto', gap:8, alignItems:'center', margin:'12px 0' }}>
            <input className="input" placeholder="Token name" value={newToken.name} onChange={(e)=>setNewToken(t=>({...t, name:e.target.value}))} />
            <input className="input" type="number" min={1} max={730} value={newToken.days} onChange={(e)=>setNewToken(t=>({...t, days:e.target.value}))} />
            <label style={{display:'inline-flex', alignItems:'center', gap:8}}><input type="checkbox" checked={newToken.scopes.write} onChange={(e)=>setNewToken(t=>({...t, scopes:{...t.scopes, write:e.target.checked}}))} /> articles:write</label>
            <label style={{display:'inline-flex', alignItems:'center', gap:8}}><input type="checkbox" checked={newToken.scopes.upload} onChange={(e)=>setNewToken(t=>({...t, scopes:{...t.scopes, upload:e.target.checked}}))} /> media:upload</label>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn btn-primary" onClick={createToken} disabled={tokBusy}>Create token</button>
            {createdRawToken && (
              <div className="muted" style={{display:'inline-flex', gap:8, alignItems:'center'}}>
                <code className="token-raw" style={{ padding:'4px 6px', border:'1px solid var(--border)', borderRadius:6, background:'var(--card)' }}>{createdRawToken}</code>
                <button className="btn" onClick={() => { navigator.clipboard.writeText(createdRawToken).catch(()=>{}) }}>Copy</button>
              </div>
            )}
          </div>
          <hr style={{ border:0, borderTop:'1px solid var(--border)', margin:'12px 0' }} />
          <table className="table">
            <thead><tr><th>Name</th><th>Scopes</th><th>Created</th><th>Expires</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {(tokens||[]).length === 0 ? (
                <tr><td colSpan="6" className="muted">No tokens yet.</td></tr>
              ) : tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.name || '-'}</td>
                  <td>{Array.isArray(t.scopes) ? t.scopes.join(', ') : '-'}</td>
                  <td>{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                  <td>{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : '—'}</td>
                  <td>{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'never'}</td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn" onClick={()=>revokeToken(t.id)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
