import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

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
  const fileRef = useRef(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    request('/me').then((m)=>{ setMe(m); setName(m.name||''); setBio(m.bio||'') }).catch(console.error)
    request('/follows/me').then(setFollows).catch(console.error)
    request('/likes/me').then(setLikes).catch(console.error)
    request('/bookmarks/me').then(setBookmarks).catch(()=>{})
    request('/reads/me').then(setReads).catch(()=>{})
    if (auth.user?.role === 'author' || auth.user?.role === 'admin') {
      request('/follows/followers/me').then(setFollowers).catch(()=>{})
    }
  }, [])

  const analytics = useMemo(() => computeAnalytics(reads), [reads])

  return (
    <div className="container page">
      <div className="tabs" role="tablist" aria-label="Profile tabs">
        <button className={`tab ${tab==='overview'?'active':''}`} role="tab" aria-selected={tab==='overview'} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab==='activity'?'active':''}`} role="tab" aria-selected={tab==='activity'} onClick={() => setTab('activity')}>Activity</button>
        <button className={`tab ${tab==='settings'?'active':''}`} role="tab" aria-selected={tab==='settings'} onClick={() => setTab('settings')}>Settings</button>
      </div>

      {tab === 'overview' && (
      <div className="profile-grid">
        <section className="section-card">
          <div className="profile-header">
            <img className="avatar-lg" src={me?.avatar_url || 'https://placehold.co/96x96?text=Avatar'} alt="avatar" />
            <div className="ph-text">
              <h2 style={{margin:'0 0 4px'}}>
                {me?.name}
                {me?.role && <span className="badge" style={{marginLeft:8, textTransform:'capitalize'}}>{me.role}</span>}
              </h2>
              <p className="muted" style={{margin:0}}>{me?.email}</p>
              <div style={{marginTop:8, display:'flex', gap:8}}>
                <input hidden ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e)=>{
                  setError(''); setSuccess('')
                  const f = e.target.files?.[0]; if (!f) return
                  const fd = new FormData(); fd.append('file', f)
                  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/avatar`, { method:'POST', headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {}, body: fd })
                  const data = await res.json().catch(()=>({}))
                  if (!res.ok) { setError(data.message || 'Avatar upload failed'); return }
                  const updated = await request('/me', { method:'PUT', body: JSON.stringify({ avatar_url: data.url, avatar_path: data.path }) })
                  setMe(updated); setAuth({ ...auth, user: { ...auth.user, name: updated.name, avatar_url: updated.avatar_url } }); setSuccess('Avatar updated')
                }}/>
                <button className="btn" onClick={()=>fileRef.current?.click()}>Change Avatar</button>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="stat-grid">
            <div className="stat"><div className="value">{follows.length}</div><div className="label">Following</div></div>
            <div className="stat"><div className="value">{followers.length}</div><div className="label">Followers</div></div>
            <div className="stat"><div className="value">{likes.length}</div><div className="label">Likes</div></div>
            <div className="stat"><div className="value">{reads.length}</div><div className="label">Reads</div></div>
          </div>
        </section>

        <section className="section-card">
          <h3 style={{marginTop:0}}>Followed authors</h3>
          <div className="chips">
            {follows.map((a) => (
              <Link to={`/author/${a.id}`} className="chip" key={a.id} style={{display:'inline-flex', alignItems:'center', gap:8}}>
                {a.avatar_url ? (<img src={a.avatar_url} width={20} height={20} style={{borderRadius:'50%'}} />) : (<span className="avatar-fallback" style={{width:20,height:20}}> {a.name?.slice(0,1).toUpperCase()} </span>)}
                {a.name}
              </Link>
            ))}
          </div>
        </section>

        {(auth.user?.role === 'author' || auth.user?.role === 'admin') && (
          <section className="section-card">
            <h3 style={{marginTop:0}}>Your followers</h3>
            <div className="chips">
              {followers.map((u) => (
                <span key={u.id} className="chip" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <img src={u.avatar_url || 'https://placehold.co/24x24'} width={24} height={24} style={{borderRadius:'50%'}} />
                  {u.name}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {tab === 'activity' && (
      <div className="profile-grid">
        <section className="section-card">
          <h3 style={{marginTop:0}}>Reading analytics</h3>
          <div className="chips" style={{marginBottom:8}}>
            <span className="chip">Total read: {formatDuration(analytics.totalSecs)}</span>
            <span className="chip">Unique articles: {analytics.uniqueArticles}</span>
          </div>
          <div className="bar-chart">
            {analytics.last7.map((d) => (
              <div key={d.key} className="bar-row">
                <div className="bar-label">{d.label}</div>
                <div className="bar-track">
                  <div className="bar" style={{ width: `${d.pct}%` }} />
                </div>
                <div className="bar-value">{formatDuration(d.secs)}</div>
              </div>
            ))}
          </div>
          {analytics.top.length > 0 && (
            <div style={{marginTop:12}}>
              <h4 style={{margin:'8px 0'}}>Top articles</h4>
              <ul className="media-list">
                {analytics.top.map((t) => (
                  <li className="media-item" key={t.id}>
                    <div className="thumb-sm thumb-empty" />
                    <div className="media-body">
                      <Link to={`/article/${t.id}`}>{t.title || 'Article'}</Link>
                      <div className="muted" style={{fontSize:'.8rem'}}>Read time: {formatDuration(t.secs)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="section-card">
          <h3 style={{marginTop:0}}>Liked articles</h3>
          <ul className="media-list">
            {likes.map((a) => (
              <li key={a.id} className="media-item">
                {a.thumbnail_url ? (
                  <img className="thumb-sm" src={a.thumbnail_url} alt="thumb" />
                ) : (
                  <div className="thumb-sm thumb-empty" />
                )}
                <div className="media-body">
                  <Link to={`/article/${a.id}`}>{a.title}</Link>
                  {a.created_at && <div className="muted" style={{fontSize:'.8rem'}}>{new Date(a.created_at).toLocaleDateString()}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {bookmarks.length > 0 && (
          <section className="section-card">
            <h3 style={{marginTop:0}}>Bookmarked</h3>
            <ul className="media-list">
              {bookmarks.map((a) => (
                <li key={a.id} className="media-item">
                  {a.thumbnail_url ? (
                    <img className="thumb-sm" src={a.thumbnail_url} alt="thumb" />
                  ) : (
                    <div className="thumb-sm thumb-empty" />
                  )}
                  <div className="media-body">
                    <Link to={`/article/${a.id}`}>{a.title}</Link>
                    {a.created_at && <div className="muted" style={{fontSize:'.8rem'}}>{new Date(a.created_at).toLocaleDateString()}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reads.length > 0 && (
          <section className="section-card">
            <h3 style={{marginTop:0}}>Reading history</h3>
            <ul className="list-clean">
              {reads.map((r, idx) => (
                <li key={idx}><Link to={`/article/${r.article?.id}`}>{r.article?.title || 'Unknown article'}</Link> — {Math.round(r.duration_seconds)}s — {new Date(r.last_read_at).toLocaleString()}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      )}

      {tab === 'settings' && (
      <div className="profile-grid">
        <section className="section-card">
          <h3 style={{marginTop:0}}>Profile settings</h3>
          <div className="form">
            <input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="Bio" rows={3} value={bio} onChange={(e)=>setBio(e.target.value)} />
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button className="btn btn-primary" onClick={async ()=>{
                setError(''); setSuccess('')
                try { const updated = await request('/me', { method:'PUT', body: JSON.stringify({ name, bio }) }); setMe(updated); setAuth({ ...auth, user: { ...auth.user, name: updated.name } }); setSuccess('Profile saved') } catch(e){ setError(e.message) }
              }}>Save Changes</button>
            </div>
            {(error || success) && (
              <div style={{display:'flex', gap:8}}>
                {error && <p className="error" style={{margin:0}}>{error}</p>}
                {success && <p className="muted" style={{color:'#10b981', margin:0}}>{success}</p>}
              </div>
            )}
          </div>
        </section>

        <section className="section-card">
          <h3 style={{marginTop:0}}>Change password</h3>
          <div className="form">
            <input placeholder="Current password" type="password" value={pwd.current} onChange={(e)=>setPwd({...pwd, current:e.target.value})} />
            <input placeholder="New password" type="password" value={pwd.next} onChange={(e)=>setPwd({...pwd, next:e.target.value})} />
            <div style={{display:'flex', justifyContent:'flex-end'}}>
              <button className="btn" onClick={async ()=>{
                setError(''); setSuccess('')
                try { const r = await request('/me/password', { method:'PUT', body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }) }); if (r?.token) setAuth({ token: r.token, user: auth.user }); setSuccess('Password changed') } catch(e){ setError(e.message) }
              }}>Update Password</button>
            </div>
          </div>
        </section>
      </div>
      )}
    </div>
  )
}

function computeAnalytics(reads) {
  const totalSecs = reads.reduce((s, r) => s + (parseInt(r.duration_seconds)||0), 0)
  const byDay = new Map()
  const byArticle = new Map()
  for (const r of reads) {
    const d = new Date(r.last_read_at)
    const key = d.toISOString().slice(0,10)
    byDay.set(key, (byDay.get(key)||0) + (parseInt(r.duration_seconds)||0))
    const id = r.article?.id || 'unknown'
    const prev = byArticle.get(id) || { id, title: r.article?.title, secs: 0 }
    prev.secs += (parseInt(r.duration_seconds)||0)
    byArticle.set(id, prev)
  }
  const last7 = []
  const today = new Date()
  let max = 0
  for (let i=6;i>=0;i--) {
    const d = new Date(today)
    d.setDate(today.getDate()-i)
    const key = d.toISOString().slice(0,10)
    const secs = byDay.get(key) || 0
    max = Math.max(max, secs)
    last7.push({ key, label: d.toLocaleDateString(undefined, { weekday:'short' }), secs })
  }
  const last7WithPct = last7.map((x) => ({ ...x, pct: max ? Math.max(4, Math.round((x.secs/max)*100)) : 0 }))
  const top = Array.from(byArticle.values()).sort((a,b)=>b.secs-a.secs).slice(0,5)
  const uniqueArticles = byArticle.size
  return { totalSecs, last7: last7WithPct, top, uniqueArticles }
}

function formatDuration(secs) {
  secs = Math.round(secs)
  const h = Math.floor(secs/3600)
  const m = Math.floor((secs%3600)/60)
  const s = secs%60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}
