import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function Profile() {
  const { request, auth, setAuth } = useAuth()
  const [follows, setFollows] = useState([])
  const [likes, setLikes] = useState([])
  const [reads, setReads] = useState([])
  const [followers, setFollowers] = useState([])
  const [me, setMe] = useState(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pwd, setPwd] = useState({ current: '', next: '' })
  const fileRef = useRef(null)

  useEffect(() => {
    request('/me').then((m)=>{ setMe(m); setName(m.name||''); setBio(m.bio||'') }).catch(console.error)
    request('/follows/me').then(setFollows).catch(console.error)
    request('/likes/me').then(setLikes).catch(console.error)
    request('/reads/me').then(setReads).catch(()=>{})
    if (auth.user?.role === 'author' || auth.user?.role === 'admin') {
      request('/follows/followers/me').then(setFollowers).catch(()=>{})
    }
  }, [])

  return (
    <div className="container page">
      <h2>{me?.name}</h2>
      <div style={{display:'flex', gap:16, alignItems:'center', marginBottom:12}}>
        <img src={me?.avatar_url || 'https://placehold.co/80x80?text=Avatar'} alt="avatar" width={64} height={64} style={{borderRadius: '50%', border:'1px solid var(--border)'}}/>
        <div>
          <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/webp" onChange={async (e)=>{
            setError(''); setSuccess('')
            const f = e.target.files?.[0]; if (!f) return
            const fd = new FormData(); fd.append('file', f)
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/uploads/avatar`, { method:'POST', headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {}, body: fd })
            const data = await res.json().catch(()=>({}))
            if (!res.ok) { setError(data.message || 'Avatar upload failed'); return }
            const updated = await request('/me', { method:'PUT', body: JSON.stringify({ avatar_url: data.url, avatar_path: data.path }) })
            setMe(updated); setAuth({ ...auth, user: { ...auth.user, name: updated.name } }); setSuccess('Avatar updated')
          }}/>
        </div>
      </div>
      <div className="form" style={{maxWidth:600, marginBottom:16}}>
        <input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
        <textarea placeholder="Bio" rows={3} value={bio} onChange={(e)=>setBio(e.target.value)} />
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-primary" onClick={async ()=>{
            setError(''); setSuccess('')
            try { const updated = await request('/me', { method:'PUT', body: JSON.stringify({ name, bio }) }); setMe(updated); setAuth({ ...auth, user: { ...auth.user, name: updated.name } }); setSuccess('Profile saved') } catch(e){ setError(e.message) }
          }}>Save Profile</button>
        </div>
      </div>
      <div className="form" style={{maxWidth:600, marginBottom:24}}>
        <h3>Change Password</h3>
        <input placeholder="Current password" type="password" value={pwd.current} onChange={(e)=>setPwd({...pwd, current:e.target.value})} />
        <input placeholder="New password" type="password" value={pwd.next} onChange={(e)=>setPwd({...pwd, next:e.target.value})} />
        <button className="btn" onClick={async ()=>{
          setError(''); setSuccess('')
          try { const r = await request('/me/password', { method:'PUT', body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }) }); if (r?.token) setAuth({ token: r.token, user: auth.user }); setSuccess('Password changed') } catch(e){ setError(e.message) }
        }}>Update Password</button>
      </div>
      {error && <p className="error">{error}</p>}
      {success && <p className="muted" style={{color:'#10b981'}}>{success}</p>}

      <h3>Followed authors</h3>
      <div className="chips">
        {follows.map((a) => <span className="chip" key={a.id}>{a.name}</span>)}
      </div>
      <h3>Liked articles</h3>
      <ul>
        {likes.map((a) => (
          <li key={a.id}>{a.title}</li>
        ))}
      </ul>
      {reads.length > 0 && (
        <>
          <h3>Reading history</h3>
          <ul>
            {reads.map((r, idx) => (
              <li key={idx}>{r.article?.title} — {Math.round(r.duration_seconds)}s — {new Date(r.last_read_at).toLocaleString()}</li>
            ))}
          </ul>
        </>
      )}
      {(auth.user?.role === 'author' || auth.user?.role === 'admin') && (
        <>
          <h3>Your followers</h3>
          <div className="chips">
            {followers.map((u) => (
              <span key={u.id} className="chip" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <img src={u.avatar_url || 'https://placehold.co/24x24'} width={24} height={24} style={{borderRadius:'50%'}} />
                {u.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
