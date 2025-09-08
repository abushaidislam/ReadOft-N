import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Comments({ articleId }) {
  const { request, auth, ui } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await request(`/articles/${articleId}/comments`, { noGlobalLoading: true })
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      ui.notify('Failed to load comments', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [articleId])

  const tree = useMemo(() => buildTree(items), [items])

  const submit = async (parent_id = null, text, clear) => {
    const body = { content: (text ?? content).trim(), parent_id }
    if (!body.content) return
    try {
      if (!parent_id) setPosting(true)
      await request(`/articles/${articleId}/comments`, { method: 'POST', body: JSON.stringify(body) })
      await load()
      if (clear) clear('')
      else setContent('')
      ui.notify('Comment posted', 'success')
    } catch (e) {
      // error toast already shown globally
    } finally {
      if (!parent_id) setPosting(false)
    }
  }

  return (
    <section className="comments">
      <h3>Comments</h3>
      {auth.user ? (
        <div className="comment-form">
          <textarea rows={3} placeholder="Write a comment…" value={content} onChange={(e) => setContent(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className={`btn btn-primary ${posting ? 'loading' : ''}`} disabled={posting || !content.trim()} onClick={() => submit(null)}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Please <Link to="/login">login</Link> to comment.</p>
      )}

      {loading ? (
        <div className="comment skeleton">
          <div className="skeleton-line w-80" />
          <div className="skeleton-line w-60" />
        </div>
      ) : tree.top.length === 0 ? (
        <p className="muted">Be the first to comment.</p>
      ) : (
        <div className="comment-list">
          {tree.top.map((c) => (
            <CommentItem key={c.id} c={c} childMap={tree.children} me={auth.user} onReply={submit} onDeleteSuccess={load} />
          ))}
        </div>
      )}
    </section>
  )
}

function CommentItem({ c, childMap, me, onReply, onDeleteSuccess }) {
  const { request, ui } = useAuth()
  const [show, setShow] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const canDelete = me && (me.id === c.user_id || me.role === 'admin')

  const del = async () => {
    if (!confirm('Delete this comment?')) return
    try {
      setBusy(true)
      await request(`/comments/${c.id}`, { method: 'DELETE' })
      ui.notify('Comment deleted', 'success')
      onDeleteSuccess()
    } catch (e) {
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="comment">
      <div className="comment-head">
        {c.user?.avatar_url ? (
          <img src={c.user.avatar_url} alt="avatar" className="avatar" loading="lazy" decoding="async" />
        ) : (
          <span className="avatar avatar-fallback">{(c.user?.name || 'U').slice(0, 1).toUpperCase()}</span>
        )}
        <div className="meta">
          <strong>{c.user?.name || 'User'}</strong>
          <span className="muted">{new Date(c.created_at).toLocaleString()}</span>
        </div>
      </div>
      <div className="comment-body">{c.content}</div>
      <div className="comment-actions">
        {me && <button className="btn" onClick={() => setShow((s) => !s)}>{show ? 'Cancel' : 'Reply'}</button>}
        {me && (
          <button className="btn" onClick={async()=>{
            try {
              const reason = prompt('Why are you reporting this comment?') || ''
              if (!reason.trim()) return
              await request('/reports', { method:'POST', body: JSON.stringify({ target_type:'comment', target_id: c.id, reason }) })
              ui.notify('Report submitted. Thank you.', 'info')
            } catch {}
          }}>Report</button>
        )}
        {canDelete && (
          <button className="btn" onClick={del} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
      {show && (
        <div className="comment-form reply">
          <textarea rows={2} placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className={`btn btn-primary ${busy ? 'loading' : ''}`} disabled={busy || !text.trim()} onClick={() => onReply(c.id, text, setText)}>
              {busy ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      )}
      {(childMap.get(c.id) || []).length > 0 && (
        <div className="replies">
          {(childMap.get(c.id) || []).map((r) => (
            <CommentItem key={r.id} c={r} childMap={childMap} me={me} onReply={onReply} onDeleteSuccess={onDeleteSuccess} />
          ))}
        </div>
      )}
    </div>
  )
}

function buildTree(list) {
  const children = new Map()
  const top = []
  for (const c of list) {
    if (c.parent_id) {
      if (!children.has(c.parent_id)) children.set(c.parent_id, [])
      children.get(c.parent_id).push(c)
    } else top.push(c)
  }
  return { top, children }
}
