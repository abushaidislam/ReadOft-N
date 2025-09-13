import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { LayoutDashboard, Users as UsersIcon, Folder, Newspaper, ClipboardCheck, Flag, Mail } from 'lucide-react'

export default function Admin() {
  const { request, ui } = useAuth()
  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [categories, setCategories] = useState([])
  const [apps, setApps] = useState([])
  const [reports, setReports] = useState([])
  const [newsletter, setNewsletter] = useState([])
  const [contacts, setContacts] = useState([])
  const [catStats, setCatStats] = useState({})
  const [kpi, setKpi] = useState(null)
  const [health, setHealth] = useState(null)
  const [catName, setCatName] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('admin_tab') || 'dashboard' } catch { return 'dashboard' }
  })
  const [loading, setLoading] = useState(true)
  // Users filters & pagination
  const [userQuery, setUserQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all') // all | reader | author | admin
  const [userStatusFilter, setUserStatusFilter] = useState('all') // all | active | banned
  const [userPage, setUserPage] = useState(1)
  const USER_PAGE_SIZE = 10
  // Reports filter
  const [reportFilter, setReportFilter] = useState('all') // all | open | reviewed | dismissed | actioned
  const [reportTargetFilter, setReportTargetFilter] = useState('all') // all | post | comment | user | category ...
  const [reportQuery, setReportQuery] = useState('') // text search on reason/reporter
  const [reportPage, setReportPage] = useState(1)
  const REPORT_PAGE_SIZE = 10
  // Users sorting
  const [userSortField, setUserSortField] = useState('name') // name | email | role | status
  const [userSortDir, setUserSortDir] = useState('asc') // asc | desc
  const toggleUserSort = (field) => {
    setUserSortField((prevField) => {
      setUserSortDir((dir) => (prevField === field ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'))
      return field
    })
  }
  // Pending preview modal state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewArticle, setPreviewArticle] = useState(null)
  const [scheduleAt, setScheduleAt] = useState('') // yyyy-MM-ddTHH:mm (local)
  const [rejectReason, setRejectReason] = useState('')
  const [previewIndex, setPreviewIndex] = useState(-1)
  // Users bulk selection/actions
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  // Reports bulk selection/actions
  const [selectedReportIds, setSelectedReportIds] = useState([])
  const [reportBulkBusy, setReportBulkBusy] = useState(false)
  const [reportNotesDraft, setReportNotesDraft] = useState({})
  const [reportSortField, setReportSortField] = useState('created') // created | target | reporter | status
  const [reportSortDir, setReportSortDir] = useState('desc') // asc | desc
  const toggleReportSort = (field) => {
    setReportSortField((prevField) => {
      setReportSortDir((dir) => (prevField === field ? (dir === 'asc' ? 'desc' : 'asc') : (field==='created' ? 'desc' : 'asc')))
      return field
    })
  }
  // User detail drawer
  const [userDrawerOpen, setUserDrawerOpen] = useState(false)
  const [userDrawerUser, setUserDrawerUser] = useState(null)
  const [userDrawerRole, setUserDrawerRole] = useState('reader')
  // Pending filters & bulk
  const [pendingQuery, setPendingQuery] = useState('')
  const [pendingPage, setPendingPage] = useState(1)
  const PENDING_PAGE_SIZE = 10
  const [selectedPendingIds, setSelectedPendingIds] = useState([])
  const [pendingBulkBusy, setPendingBulkBusy] = useState(false)
  const [pendingSortField, setPendingSortField] = useState('created') // title | author | created
  const [pendingSortDir, setPendingSortDir] = useState('desc')
  const togglePendingSort = (field) => {
    setPendingSortField((prevField) => {
      setPendingSortDir((dir) => (prevField === field ? (dir === 'asc' ? 'desc' : 'asc') : (field==='created' ? 'desc' : 'asc')))
      return field
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, p, c, a, r, cs, ov, h, nl, cm] = await Promise.all([
        request('/admin/users', { noGlobalLoading: true }),
        request('/admin/articles/pending', { noGlobalLoading: true }),
        request('/categories', { noGlobalLoading: true }),
        request('/admin/author-requests', { noGlobalLoading: true }),
        request('/admin/reports', { noGlobalLoading: true }),
        request('/admin/categories/stats', { noGlobalLoading: true }),
        request('/admin/analytics/overview', { noGlobalLoading: true }),
        request('/admin/health', { noGlobalLoading: true }),
        request('/newsletter/list', { noGlobalLoading: true }),
        request('/contact/list', { noGlobalLoading: true }),
      ])
      setUsers(u)
      setPending(p)
      setCategories(c)
      setApps(a)
      setReports(r)
      setCatStats(cs || {})
      setKpi(ov || null)
      setHealth(h || null)
      setNewsletter(Array.isArray(nl) ? nl : [])
      setContacts(Array.isArray(cm) ? cm : [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => { load().catch(console.error) }, [load])
  useEffect(() => { try { localStorage.setItem('admin_tab', tab) } catch (e) { if (import.meta.env.DEV) console.debug('persist admin_tab failed', e) } }, [tab])

  // Derived users list per filters
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    const arr = (users || []).filter((u) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
      if (userStatusFilter === 'active' && u.is_banned) return false
      if (userStatusFilter === 'banned' && !u.is_banned) return false
      if (!q) return true
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    const accessor = (u) => {
      if (userSortField === 'name') return (u.name || '')
      if (userSortField === 'email') return (u.email || '')
      if (userSortField === 'role') return (u.role || '')
      if (userSortField === 'status') return u.is_banned ? 'banned' : 'active'
      return (u.name || '')
    }
    arr.sort((a, b) => {
      const va = String(accessor(a) || '').toLowerCase()
      const vb = String(accessor(b) || '').toLowerCase()
      if (va < vb) return userSortDir === 'asc' ? -1 : 1
      if (va > vb) return userSortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [users, userQuery, userRoleFilter, userStatusFilter, userSortField, userSortDir])

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE))
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USER_PAGE_SIZE
    return filteredUsers.slice(start, start + USER_PAGE_SIZE)
  }, [filteredUsers, userPage])

  useEffect(() => { setUserPage(1) }, [userQuery, userRoleFilter, userStatusFilter])
  useEffect(() => { setSelectedUserIds([]) }, [userQuery, userRoleFilter, userStatusFilter, userPage])

  const setRole = async (id, role) => {
    await request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }), noGlobalLoading: true })
    ui.notify('Role updated', 'success')
    load()
  }

  const openUserDrawer = (u) => { setUserDrawerUser(u); setUserDrawerRole(u.role || 'reader'); setUserDrawerOpen(true) }
  const closeUserDrawer = () => setUserDrawerOpen(false)

  const approve = useCallback(async (id) => {
    await request(`/articles/${id}/approve`, { method: 'POST', noGlobalLoading: true })
    ui.notify('Article approved', 'success')
    load()
  }, [request, ui, load])

  const reject = useCallback(async (id, reasonParam) => {
    const reason = typeof reasonParam === 'string' ? reasonParam : (prompt('Reason for rejection? (optional)') || '')
    await request(`/articles/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }), noGlobalLoading: true })
    ui.notify('Article rejected', 'info')
    load()
  }, [request, ui, load])

  const deleteArticle = async (id) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await request(`/articles/${id}`, { method: 'DELETE', noGlobalLoading: true })
    ui.notify('Article deleted', 'success')
    load()
  }

  const addCategory = async () => {
    if (!catName.trim()) return
    await request('/categories', { method: 'POST', body: JSON.stringify({ name: catName, slug: catSlug || undefined }), noGlobalLoading: true })
    ui.notify('Category added', 'success')
    setCatName(''); setCatSlug(''); load()
  }
  const updateCategory = async (id, patch) => {
    await request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(patch), noGlobalLoading: true })
    ui.notify('Category updated', 'success')
    load()
  }
  const deleteCategory = async (id) => {
    await request(`/categories/${id}`, { method: 'DELETE', noGlobalLoading: true })
    ui.notify('Category deleted', 'success')
    load()
  }

  const updateReport = async (id, patch) => {
    await request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify(patch), noGlobalLoading: true })
    ui.notify('Report updated', 'success')
    load()
  }

  // Pending preview modal logic
  const openPreview = useCallback(async (id) => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewArticle(null)
    setScheduleAt('')
    setRejectReason('')
    setPreviewIndex(pending.findIndex((x) => x.id === id))
    try {
      const art = await request(`/articles/${id}`, { noGlobalLoading: true })
      setPreviewArticle(art)
    } catch (e) {
      ui.notify(e?.message || 'Failed to load preview', 'error')
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }, [pending, request, ui])
  const closePreview = () => setPreviewOpen(false)
  const openPrevPreview = useCallback(() => { if (previewIndex > 0) openPreview(pending[previewIndex - 1].id) }, [previewIndex, pending, openPreview])
  const openNextPreview = useCallback(() => { if (previewIndex >= 0 && previewIndex < pending.length - 1) openPreview(pending[previewIndex + 1].id) }, [previewIndex, pending, openPreview])

  // Approve with schedule
  function localToIso(dtLocal) {
    // dtLocal from <input type="datetime-local"> like '2025-09-11T22:30'
    if (!dtLocal) return null
    const d = new Date(dtLocal)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  }
  const approveScheduled = useCallback(async (id, dtLocal) => {
    const iso = localToIso(dtLocal)
    if (!iso) { ui.notify('Invalid date/time', 'error'); return }
    await request(`/articles/${id}/approve`, { method: 'POST', body: JSON.stringify({ publish_at: iso }), noGlobalLoading: true })
    ui.notify('Article scheduled', 'success')
    closePreview()
    load()
  }, [request, ui, load])

  // Keyboard shortcuts for preview modal
  useEffect(() => {
    if (!previewOpen) return
    const onKey = (e) => {
      const id = previewArticle?.id
      if (!id) return
      if (e.key === 'Escape') { e.preventDefault(); closePreview(); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); openPrevPreview(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); openNextPreview(); return }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); approve(id).catch((err) => { if (import.meta.env.DEV) console.debug('approve shortcut failed', err) }); closePreview(); return }
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); reject(id, rejectReason).catch((err) => { if (import.meta.env.DEV) console.debug('reject shortcut failed', err) }); closePreview(); return }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (scheduleAt) approveScheduled(id, scheduleAt).catch((err) => { if (import.meta.env.DEV) console.debug('schedule shortcut failed', err) })
        else {
          const v = prompt('Schedule publish at (YYYY-MM-DDTHH:mm) local time') || ''
          if (v) approveScheduled(id, v).catch((err) => { if (import.meta.env.DEV) console.debug('schedule prompt failed', err) })
        }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpen, previewArticle?.id, rejectReason, scheduleAt, openPrevPreview, openNextPreview, approve, approveScheduled, reject])

  const DashboardView = () => (
    <div className="grid two">
      <section className="section-card">
        <h3 style={{marginTop:0}}>Overview</h3>
        <div className="stat-grid">
          <div className="stat"><div className="value">{users.length}</div><div className="label">Users</div><div className="muted" style={{ fontSize: '.8rem', marginTop: 4 }}>+{kpi?.newUsersLast7Days || 0} this week</div></div>
          <div className="stat"><div className="value">{pending.length}</div><div className="label">Pending</div><div className="muted" style={{ fontSize: '.8rem', marginTop: 4 }}>Need review</div></div>
          <div className="stat"><div className="value">{categories.length}</div><div className="label">Categories</div><div className="muted" style={{ fontSize: '.8rem', marginTop: 4 }}>{Object.keys(catStats||{}).length} in use</div></div>
          <div className="stat"><div className="value">{reports.filter(r=>r.status==='open').length}</div><div className="label">Open Reports</div><div className="muted" style={{ fontSize: '.8rem', marginTop: 4 }}>Total {reports.length}</div></div>
        </div>
      </section>
      <section className="section-card">
        <h3 style={{marginTop:0}}>Quick actions</h3>
        <div className="chips">
          <button className="chip" onClick={()=>setTab('users')}>Manage users</button>
          <button className="chip" onClick={()=>setTab('pending')}>Review pending</button>
          <button className="chip" onClick={()=>setTab('categories')}>Edit categories</button>
        </div>
      </section>
      <section className="section-card">
        <h3 style={{marginTop:0}}>System Health</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {(() => {
            const counts = health?.counts || {}
            const items = [
              { key: 'users', label: 'Users' },
              { key: 'articles', label: 'Articles' },
              { key: 'comments', label: 'Comments' },
              { key: 'article_views', label: 'Views' },
              { key: 'reports', label: 'Reports' },
            ]
            return items.map((it) => (
              <div key={it.key} className="stat">
                <div className="value">{counts[it.key] ?? '—'}</div>
                <div className="label">{it.label}</div>
              </div>
            ))
          })()}
        </div>
        <div className="muted" style={{ fontSize: '.8rem', marginTop: 6 }}>Last updated: {health?.at ? new Date(health.at).toLocaleString() : '—'}</div>
      </section>
    </div>
  )

  const UsersView = () => (
      <section className="section-card">
        <h3>Users</h3>
        <div className="filters" style={{ alignItems: 'center' }}>
          <input
            placeholder="Search name or email"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            aria-label="Search users"
          />
          <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} aria-label="Filter by role">
            <option value="all">All roles</option>
            <option value="reader">Reader</option>
            <option value="author">Author</option>
            <option value="admin">Admin</option>
          </select>
          <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div className="card-actions" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div className="muted" style={{ fontSize: '.9rem' }}>{selectedUserIds.length} selected</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label className="muted" style={{ fontSize: '.9rem' }}>Role</label>
            <select id="bulkRole" disabled={bulkBusy || selectedUserIds.length===0} onChange={() => {}}>
              <option value="reader">reader</option>
              <option value="author">author</option>
              <option value="admin">admin</option>
            </select>
            <button className="btn" disabled={bulkBusy || selectedUserIds.length===0} onClick={async()=>{
              const sel = document.getElementById('bulkRole'); const role = sel ? sel.value : 'reader';
              setBulkBusy(true)
              try {
                await Promise.all(selectedUserIds.map(id => request(`/admin/users/${id}/role`, { method:'PUT', body: JSON.stringify({ role }), noGlobalLoading: true })))
                ui.notify('Roles updated', 'success')
                load()
              } catch(e) { ui.notify(e?.message||'Failed to update roles','error') } finally { setBulkBusy(false); setSelectedUserIds([]) }
            }}>Apply</button>
            <button className="btn" disabled={bulkBusy || selectedUserIds.length===0} onClick={async()=>{
              setBulkBusy(true)
              try { await Promise.all(selectedUserIds.map(id => request(`/admin/users/${id}/ban`, { method:'PUT', body: JSON.stringify({ banned: true }), noGlobalLoading: true }))); ui.notify('Banned selected','success'); load() } catch(e){ ui.notify(e?.message || 'Failed to ban some users','error') } finally { setBulkBusy(false); setSelectedUserIds([]) }
            }}>Ban</button>
            <button className="btn" disabled={bulkBusy || selectedUserIds.length===0} onClick={async()=>{
              setBulkBusy(true)
              try { await Promise.all(selectedUserIds.map(id => request(`/admin/users/${id}/ban`, { method:'PUT', body: JSON.stringify({ banned: false }), noGlobalLoading: true }))); ui.notify('Unbanned selected','success'); load() } catch(e){ ui.notify(e?.message || 'Failed to unban some users','error') } finally { setBulkBusy(false); setSelectedUserIds([]) }
            }}>Unban</button>
            <button className="btn" onClick={()=>setSelectedUserIds([])} disabled={selectedUserIds.length===0}>Clear</button>
            <button className="btn" onClick={()=>{
              // Export filtered users
              const headers = ['name','email','role','status','created_at']
              const rows = filteredUsers.map(u => [u.name||'', u.email||'', u.role||'', (u.is_banned?'banned':'active'), u.created_at||''])
              const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
              const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='users_export.csv'; a.click(); URL.revokeObjectURL(url)
            }}>Export CSV</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>
                {(() => {
                  const allOnPage = paginatedUsers.length>0 && paginatedUsers.every(u => selectedUserIds.includes(u.id))
                  return (
                    <input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={() => {
                      const idsOnPage = paginatedUsers.map(u=>u.id)
                      if (allOnPage) setSelectedUserIds(prev => prev.filter(id => !idsOnPage.includes(id)))
                      else setSelectedUserIds(prev => Array.from(new Set([...prev, ...idsOnPage])))
                    }} />
                  )
                })()}
              </th>
              <th className="sortable" onClick={() => toggleUserSort('name')}>Name{userSortField==='name' ? (userSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
              <th className="sortable" onClick={() => toggleUserSort('email')}>Email{userSortField==='email' ? (userSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
              <th className="sortable" onClick={() => toggleUserSort('role')}>Role{userSortField==='role' ? (userSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
              <th className="sortable" onClick={() => toggleUserSort('status')}>Status{userSortField==='status' ? (userSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr><td colSpan="6" className="muted">No users found</td></tr>
            ) : paginatedUsers.map((u) => (
              <tr key={u.id}>
                <td><input type="checkbox" aria-label={`Select ${u.email}`} checked={selectedUserIds.includes(u.id)} onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id!==u.id) : [...prev, u.id])} /></td>
                <td>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <span>{u.name}</span>
                    {u.is_verified && (
                      <span title="Verified" aria-label="Verified" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:16, height:16, borderRadius:'50%', background:'var(--primary)', color:'#fff', fontSize:10, lineHeight:1 }}>✓</span>
                    )}
                  </span>
                </td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.is_banned ? <span className="badge pending">banned</span> : <span className="badge published">active</span>}</td>
                <td style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={() => openUserDrawer(u)}>View</button>
                  <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                    <option value="reader">reader</option>
                    <option value="author">author</option>
                    <option value="admin">admin</option>
                  </select>
                  <button className="btn" onClick={async()=>{ await request(`/admin/users/${u.id}/ban`, { method:'PUT', body: JSON.stringify({ banned: !u.is_banned }), noGlobalLoading: true }); load() }}>{u.is_banned?'Unban':'Ban'}</button>
                  <button className="btn" onClick={async()=>{ await request(`/admin/users/${u.id}/verify`, { method:'PUT', body: JSON.stringify({ verified: !u.is_verified }), noGlobalLoading: true }); ui.notify(u.is_verified ? 'Unverified' : 'Verified', 'success'); load() }}>{u.is_verified ? 'Unverify' : 'Verify'}</button>
                  <button className="btn" onClick={async()=>{ if (confirm('Delete user account? This cannot be undone.')) { await request(`/admin/users/${u.id}`, { method:'DELETE', noGlobalLoading: true }); load() } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop: 8 }}>
          <div className="muted" style={{ fontSize: '.9rem' }}>
            Page {userPage} of {totalUserPages} • {filteredUsers.length} results
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="btn" onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage <= 1}>Prev</button>
            <button className="btn" onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))} disabled={userPage >= totalUserPages}>Next</button>
          </div>
        </div>
      </section>
  )

  const NewsletterView = () => {
    const items = newsletter || []
    return (
      <section className="section-card">
        <h3 style={{marginTop:0}}>Newsletter Subscribers</h3>
        <div className="card-actions" style={{ justifyContent:'flex-end' }}>
          <button className="btn" onClick={() => {
            const headers = ['email','created_at']
            const rows = items.map(n => [n.email||'', n.created_at||''])
            const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href=url; a.download='newsletter_subscribers.csv'; a.click(); URL.revokeObjectURL(url)
          }}>Export CSV</button>
        </div>
        <table className="table">
          <thead><tr><th>Email</th><th>Subscribed</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="2" className="muted">No subscribers yet</td></tr>
            ) : items.map((n) => (
              <tr key={n.id}>
                <td>{n.email}</td>
                <td>{n.created_at ? new Date(n.created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  const ContactView = () => {
    const items = contacts || []
    return (
      <section className="section-card">
        <h3 style={{marginTop:0}}>Contact Messages</h3>
        <div className="card-actions" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div className="muted" style={{ fontSize: '.9rem' }}>{items.length} messages</div>
          <button className="btn" onClick={() => {
            const headers = ['name','email','message','created_at']
            const rows = items.map(m => [m.name||'', m.email||'', (m.message||'').replaceAll('\n',' '), m.created_at||''])
            const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href=url; a.download='contact_messages.csv'; a.click(); URL.revokeObjectURL(url)
          }}>Export CSV</button>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Message</th><th>Received</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="4" className="muted">No messages</td></tr>
            ) : items.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td style={{maxWidth:480, whiteSpace:'pre-wrap'}}>{m.message}</td>
                <td>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  const filteredPending = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase()
    const arr = (pending || []).filter(a => {
      if (!q) return true
      const title = (a.title || '').toLowerCase()
      const author = (a.author?.name || String(a.author_id || '')).toLowerCase()
      return title.includes(q) || author.includes(q)
    })
    const accessor = (a) => {
      if (pendingSortField === 'title') return (a.title || '')
      if (pendingSortField === 'author') return (a.author?.name || String(a.author_id || ''))
      if (pendingSortField === 'created') return new Date(a.created_at).getTime() || 0
      return new Date(a.created_at).getTime() || 0
    }
    arr.sort((a,b)=>{
      const va = accessor(a)
      const vb = accessor(b)
      if (typeof va === 'number' && typeof vb === 'number') return pendingSortDir==='asc' ? va - vb : vb - va
      const sa = String(va).toLowerCase(); const sb = String(vb).toLowerCase()
      if (sa < sb) return pendingSortDir==='asc' ? -1 : 1
      if (sa > sb) return pendingSortDir==='asc' ? 1 : -1
      return 0
    })
    return arr
  }, [pending, pendingQuery, pendingSortField, pendingSortDir])

  const totalPendingPages = Math.max(1, Math.ceil(filteredPending.length / PENDING_PAGE_SIZE))
  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * PENDING_PAGE_SIZE
    return filteredPending.slice(start, start + PENDING_PAGE_SIZE)
  }, [filteredPending, pendingPage])

  useEffect(() => { setPendingPage(1) }, [pendingQuery])
  useEffect(() => { setSelectedPendingIds([]) }, [pendingQuery, pendingPage])

  const PendingView = () => (
      <section className="section-card">
        <h3>Pending Articles</h3>
        <div className="filters" style={{ alignItems: 'center' }}>
          <input
            placeholder="Search title or author"
            value={pendingQuery}
            onChange={(e)=>setPendingQuery(e.target.value)}
            aria-label="Search pending articles"
          />
        </div>
        <div className="card-actions" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div className="muted" style={{ fontSize: '.9rem' }}>{selectedPendingIds.length} selected</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" disabled={pendingBulkBusy || selectedPendingIds.length===0} onClick={async()=>{
              setPendingBulkBusy(true)
              try { await Promise.all(selectedPendingIds.map(id => request(`/articles/${id}/approve`, { method:'POST', noGlobalLoading: true }))); ui.notify('Approved selected','success'); load() } catch(e){ ui.notify(e?.message||'Failed to approve some','error') } finally { setPendingBulkBusy(false); setSelectedPendingIds([]) }
            }}>Approve Selected</button>
            <button className="btn" disabled={pendingBulkBusy || selectedPendingIds.length===0} onClick={async()=>{
              const reason = prompt('Reason for rejection? (optional)')||''
              setPendingBulkBusy(true)
              try { await Promise.all(selectedPendingIds.map(id => request(`/articles/${id}/reject`, { method:'POST', body: JSON.stringify({ reason }), noGlobalLoading: true }))); ui.notify('Rejected selected','success'); load() } catch(e){ ui.notify(e?.message||'Failed to reject some','error') } finally { setPendingBulkBusy(false); setSelectedPendingIds([]) }
            }}>Reject Selected</button>
            <button className="btn" onClick={()=>setSelectedPendingIds([])} disabled={selectedPendingIds.length===0}>Clear</button>
            <button className="btn" onClick={()=>{
              const headers = ['id','title','author','created_at']
              const rows = filteredPending.map(a => [a.id, a.title||'', (a.author?.name||a.author_id||''), a.created_at||''])
              const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
              const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='pending_export.csv'; a.click(); URL.revokeObjectURL(url)
            }}>Export CSV</button>
          </div>
        </div>
        <table className="table">
          <thead><tr>
            <th>
              {(() => {
                const allOnPage = paginatedPending.length>0 && paginatedPending.every(a => selectedPendingIds.includes(a.id))
                return (
                  <input type="checkbox" aria-label="Select all pending on page" checked={allOnPage} onChange={() => {
                    const idsOnPage = paginatedPending.map(a=>a.id)
                    if (allOnPage) setSelectedPendingIds(prev => prev.filter(id => !idsOnPage.includes(id)))
                    else setSelectedPendingIds(prev => Array.from(new Set([...prev, ...idsOnPage])))
                  }} />
                )
              })()}
            </th>
            <th className="sortable" onClick={() => togglePendingSort('title')}>Title{pendingSortField==='title' ? (pendingSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
            <th className="sortable" onClick={() => togglePendingSort('author')}>Author{pendingSortField==='author' ? (pendingSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
            <th className="sortable" onClick={() => togglePendingSort('created')}>Created{pendingSortField==='created' ? (pendingSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
            <th>Actions</th></tr>
          </thead>
          <tbody>
            {paginatedPending.length === 0 ? (
              <tr><td colSpan="5" className="muted">No pending articles</td></tr>
            ) : paginatedPending.map((a) => (
              <tr key={a.id}>
                <td><input type="checkbox" aria-label={`Select ${a.title}`} checked={selectedPendingIds.includes(a.id)} onChange={() => setSelectedPendingIds(prev => prev.includes(a.id) ? prev.filter(id => id!==a.id) : [...prev, a.id])} /></td>
                <td>{a.title}</td>
                <td>
                  <Link to={`/author/${a.author?.id || a.author_id}`} className="chip author-chip">
                    {a.author?.avatar_url ? (
                      <img className="avatar" src={a.author.avatar_url} alt={a.author?.name || 'Author'} />
                    ) : (
                      <span className="avatar avatar-fallback">{(a.author?.name || 'A').slice(0,1).toUpperCase()}</span>
                    )}
                    <span className="author-name">{a.author?.name || a.author_id}</span>
                  </Link>
                </td>
                <td>{a.created_at ? new Date(a.created_at).toLocaleString() : '-'}</td>
                <td style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={() => openPreview(a.id)}>Preview</button>
                  <button className="btn" onClick={() => { const v = prompt('Schedule publish at (YYYY-MM-DDTHH:mm) local time'); if (v) approveScheduled(a.id, v) }}>Schedule</button>
                  <button className="btn btn-primary" onClick={() => approve(a.id)}>Approve</button>
                  <button className="btn" onClick={() => reject(a.id)}>Reject</button>
                  <button className="btn" onClick={() => deleteArticle(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop: 8 }}>
          <div className="muted" style={{ fontSize: '.9rem' }}>
            Page {pendingPage} of {totalPendingPages} • {filteredPending.length} results
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="btn" onClick={() => setPendingPage((p) => Math.max(1, p - 1))} disabled={pendingPage <= 1}>Prev</button>
            <button className="btn" onClick={() => setPendingPage((p) => Math.min(totalPendingPages, p + 1))} disabled={pendingPage >= totalPendingPages}>Next</button>
          </div>
        </div>
      </section>
  )

  const CategoriesView = () => (
      <section className="section-card">
        <h3>Categories</h3>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <Link className="btn" to="/admin/categories">Open full page</Link>
        </div>
        <div className="form" style={{marginBottom:12}}>
          <input placeholder="Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <input placeholder="Slug (optional)" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} />
          <button className="btn btn-primary" onClick={addCategory}>Add</button>
        </div>
        <div className="card-actions" style={{ justifyContent:'flex-end' }}>
          <button className="btn" onClick={()=>{
            const headers = ['name','slug','usage']
            const rows = categories.map(c => [c.name||'', c.slug||'', (catStats[c.slug]||0)])
            const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href=url; a.download='categories_export.csv'; a.click(); URL.revokeObjectURL(url)
          }}>Export CSV</button>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Slug</th><th>Usage</th><th>Actions</th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>
                  <span className="badge">{catStats[c.slug] || 0}</span>
                  <a className="btn btn-link" href={`/category/${c.slug}`} target="_blank" rel="noreferrer">View</a>
                </td>
                <td>
                  <button className="btn" onClick={() => {
                    const name = prompt('Rename category', c.name)
                    if (name && name !== c.name) updateCategory(c.id, { name })
                  }}>Rename</button>
                  <button className="btn" onClick={() => {
                    const slug = prompt('Update slug', c.slug)
                    if (slug && slug !== c.slug) updateCategory(c.id, { slug })
                  }}>Slug</button>
                  <button className="btn" onClick={() => { if (confirm('Delete category?')) deleteCategory(c.id) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
  )

  const ApplicationsView = () => (
    <section className="section-card">
      <h3 style={{marginTop:0}}>Author Applications</h3>
      <table className="table">
        <thead><tr><th>User</th><th>Email</th><th>Requested</th><th>Actions</th></tr></thead>
        <tbody>
          {(apps||[]).map((r) => (
            <tr key={r.id}>
              <td>{r.payload?.name || r.payload?.user_id || 'User'}</td>
              <td>{r.payload?.email || '-'}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td style={{display:'flex', gap:8}}>
                <button className="btn btn-primary" onClick={async()=>{ await request(`/admin/author-requests/${r.id}/approve`, { method:'POST', noGlobalLoading: true }); load() }}>Approve</button>
                <button className="btn" onClick={async()=>{ const reason = prompt('Reason? (optional)')||''; await request(`/admin/author-requests/${r.id}/reject`, { method:'POST', body: JSON.stringify({ reason }), noGlobalLoading: true }); load() }}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )

  // Skeletons
  const TableSkeleton = ({ rows = 5, cols = 5 }) => (
    <section className="section-card">
      <div className="skeleton">
        <div className="skeleton-line w-60" style={{ height: '20px', marginBottom: '12px' }} />
        <div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              {Array.from({ length: cols }).map((__, j) => (
                <div key={j} className="skeleton-line" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )

  const DashboardSkeleton = () => (
    <div className="grid two">
      <section className="section-card">
        <div className="skeleton">
          <div className="skeleton-line w-40" style={{ height: '20px', marginBottom: '12px' }} />
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat">
                <div className="skeleton-line w-60" style={{ height: '24px' }} />
                <div className="skeleton-line w-40" style={{ height: '12px', marginTop: '8px' }} />
                <div className="skeleton-line w-50" style={{ height: '10px', marginTop: '6px' }} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-card">
        <div className="skeleton">
          <div className="skeleton-line w-40" style={{ height: '20px', marginBottom: '12px' }} />
          <div className="skeleton-row">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-chip" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )

  const reportCounts = useMemo(() => ({
    total: reports.length,
    open: reports.filter(r=>r.status==='open').length,
    reviewed: reports.filter(r=>r.status==='reviewed').length,
    dismissed: reports.filter(r=>r.status==='dismissed').length,
    actioned: reports.filter(r=>r.status==='actioned').length,
  }), [reports])

  const filteredReports = useMemo(() => {
    const q = reportQuery.trim().toLowerCase()
    const arr = (reports || [])
      .filter((r) => reportFilter === 'all' ? true : r.status === reportFilter)
      .filter((r) => reportTargetFilter === 'all' ? true : r.target_type === reportTargetFilter)
      .filter((r) => {
        if (!q) return true
        const reason = (r.reason || '').toLowerCase()
        const reporter = (r.reporter?.name || String(r.reporter_id || '')).toLowerCase()
        return reason.includes(q) || reporter.includes(q)
      })
    const accessor = (r) => {
      if (reportSortField === 'created') return new Date(r.created_at).getTime() || 0
      if (reportSortField === 'target') return (r.target_type || '')
      if (reportSortField === 'reporter') return (r.reporter?.name || String(r.reporter_id || ''))
      if (reportSortField === 'status') return (r.status || '')
      return new Date(r.created_at).getTime() || 0
    }
    arr.sort((a,b) => {
      const va = accessor(a)
      const vb = accessor(b)
      if (typeof va === 'number' && typeof vb === 'number') return reportSortDir==='asc' ? va - vb : vb - va
      const sa = String(va).toLowerCase(); const sb = String(vb).toLowerCase()
      if (sa < sb) return reportSortDir==='asc' ? -1 : 1
      if (sa > sb) return reportSortDir==='asc' ? 1 : -1
      return 0
    })
    return arr
  }, [reports, reportFilter, reportTargetFilter, reportQuery, reportSortField, reportSortDir])

  const totalReportPages = Math.max(1, Math.ceil(filteredReports.length / REPORT_PAGE_SIZE))
  const paginatedReports = useMemo(() => {
    const start = (reportPage - 1) * REPORT_PAGE_SIZE
    return filteredReports.slice(start, start + REPORT_PAGE_SIZE)
  }, [filteredReports, reportPage])

  useEffect(() => { setReportPage(1) }, [reportFilter, reportTargetFilter, reportQuery])
  useEffect(() => { setSelectedReportIds([]) }, [reportFilter, reportTargetFilter, reportQuery, reportPage])

  const ReportsView = () => (
    <section className="section-card">
      <h3 style={{marginTop:0}}>Reports</h3>
      <div className="muted" style={{marginBottom:8}}>Open: {reportCounts.open} • Total: {reportCounts.total}</div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[
          { key:'all', label:`All (${reportCounts.total})` },
          { key:'open', label:`Open (${reportCounts.open})` },
          { key:'reviewed', label:`Reviewed (${reportCounts.reviewed})` },
          { key:'dismissed', label:`Dismissed (${reportCounts.dismissed})` },
          { key:'actioned', label:`Actioned (${reportCounts.actioned})` },
        ].map(x => (
          <button
            key={x.key}
            className="chip"
            onClick={() => setReportFilter(x.key)}
            style={reportFilter===x.key ? { background:'rgba(99,102,241,.15)', borderColor:'var(--primary)' } : undefined}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="filters" style={{ alignItems: 'center' }}>
        <input
          placeholder="Search reason or reporter"
          value={reportQuery}
          onChange={(e) => setReportQuery(e.target.value)}
          aria-label="Search reports"
        />
        <select value={reportTargetFilter} onChange={(e) => setReportTargetFilter(e.target.value)} aria-label="Filter by target type">
          <option value="all">All targets</option>
          <option value="post">Post</option>
          <option value="comment">Comment</option>
          <option value="user">User</option>
          <option value="category">Category</option>
        </select>
      </div>
      <div className="card-actions" style={{ justifyContent:'space-between', alignItems:'center' }}>
        <div className="muted" style={{ fontSize: '.9rem' }}>{selectedReportIds.length} selected</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" disabled={reportBulkBusy || selectedReportIds.length===0} onClick={async()=>{
            setReportBulkBusy(true)
            try { await Promise.all(selectedReportIds.map(id => request(`/admin/reports/${id}`, { method:'PUT', body: JSON.stringify({ status: 'reviewed' }), noGlobalLoading: true }))); ui.notify('Marked reviewed','success'); load() } catch(e) { ui.notify(e?.message||'Failed to update','error') } finally { setReportBulkBusy(false); setSelectedReportIds([]) }
          }}>Mark Reviewed</button>
          <button className="btn" disabled={reportBulkBusy || selectedReportIds.length===0} onClick={async()=>{
            setReportBulkBusy(true)
            try { await Promise.all(selectedReportIds.map(id => request(`/admin/reports/${id}`, { method:'PUT', body: JSON.stringify({ status: 'dismissed' }), noGlobalLoading: true }))); ui.notify('Dismissed selected','success'); load() } catch(e) { ui.notify(e?.message||'Failed to update','error') } finally { setReportBulkBusy(false); setSelectedReportIds([]) }
          }}>Dismiss</button>
          <button className="btn" disabled={reportBulkBusy || selectedReportIds.length===0} onClick={async()=>{
            setReportBulkBusy(true)
            try { await Promise.all(selectedReportIds.map(id => request(`/admin/reports/${id}`, { method:'PUT', body: JSON.stringify({ status: 'actioned' }), noGlobalLoading: true }))); ui.notify('Actioned selected','success'); load() } catch(e) { ui.notify(e?.message||'Failed to update','error') } finally { setReportBulkBusy(false); setSelectedReportIds([]) }
          }}>Actioned</button>
          <button className="btn" onClick={()=>setSelectedReportIds([])} disabled={selectedReportIds.length===0}>Clear</button>
          <button className="btn" onClick={()=>{
            const headers = ['created_at','target_type','target_id','reporter','status','reason']
            const rows = filteredReports.map(r => [r.created_at||'', r.target_type||'', r.target_id||'', (r.reporter?.name||r.reporter_id||''), r.status||'', (r.reason||'')])
            const csv = [headers.join(','), ...rows.map(r=> r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href=url; a.download='reports_export.csv'; a.click(); URL.revokeObjectURL(url)
          }}>Export CSV</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr><th>
            {(() => {
              const allOnPage = paginatedReports.length>0 && paginatedReports.every(r => selectedReportIds.includes(r.id))
              return (
                <input type="checkbox" aria-label="Select all reports on page" checked={allOnPage} onChange={() => {
                  const idsOnPage = paginatedReports.map(r=>r.id)
                  if (allOnPage) setSelectedReportIds(prev => prev.filter(id => !idsOnPage.includes(id)))
                  else setSelectedReportIds(prev => Array.from(new Set([...prev, ...idsOnPage])))
                }} />
              )
            })()}
          </th>
          <th className="sortable" onClick={() => toggleReportSort('created')}>Created{reportSortField==='created' ? (reportSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
          <th className="sortable" onClick={() => toggleReportSort('target')}>Target{reportSortField==='target' ? (reportSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
          <th className="sortable" onClick={() => toggleReportSort('reporter')}>Reporter{reportSortField==='reporter' ? (reportSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
          <th>Reason</th>
          <th className="sortable" onClick={() => toggleReportSort('status')}>Status{reportSortField==='status' ? (reportSortDir==='asc' ? ' ↑' : ' ↓') : ''}</th>
          <th>Notes</th>
          <th>Actions</th></tr>
        </thead>
        <tbody>
          {paginatedReports.length === 0 ? (
            <tr><td colSpan="8" className="muted">No reports</td></tr>
          ) : paginatedReports.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" aria-label={`Select report ${r.id}`} checked={selectedReportIds.includes(r.id)} onChange={() => setSelectedReportIds(prev => prev.includes(r.id) ? prev.filter(id => id!==r.id) : [...prev, r.id])} /></td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>
                <span className="chip">{r.target_type}</span>
                {r.target_type==='post' && <a className="btn btn-link" href={`/article/${r.target_id}`} target="_blank" rel="noreferrer">Open</a>}
              </td>
              <td>{r.reporter?.name || r.reporter_id}</td>
              <td style={{maxWidth:420, whiteSpace:'pre-wrap'}}>{r.reason}</td>
              <td>{r.status}</td>
              <td style={{ minWidth: 200 }}>
                <div className="form">
                  <textarea
                    rows={2}
                    placeholder="Notes..."
                    value={(reportNotesDraft[r.id] ?? (r.notes || ''))}
                    onChange={(e)=> setReportNotesDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                  />
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn" onClick={()=> updateReport(r.id, { notes: (reportNotesDraft[r.id] ?? (r.notes || '')) })}>Save</button>
                  </div>
                </div>
              </td>
              <td style={{display:'flex', gap:8}}>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'reviewed' })}>Review</button>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'dismissed' })}>Dismiss</button>
                <button className="btn" onClick={()=>updateReport(r.id, { status: 'actioned' })}>Actioned</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop: 8 }}>
        <div className="muted" style={{ fontSize: '.9rem' }}>
          Page {reportPage} of {totalReportPages} • {filteredReports.length} results
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn" onClick={() => setReportPage((p) => Math.max(1, p - 1))} disabled={reportPage <= 1}>Prev</button>
          <button className="btn" onClick={() => setReportPage((p) => Math.min(totalReportPages, p + 1))} disabled={reportPage >= totalReportPages}>Next</button>
        </div>
      </div>
    </section>
  )

  return (
    <div className="container page">
      <h2>Admin Panel</h2>
      {error && <p className="error">{error}</p>}
      <div className="admin-layout">
        <aside className="admin-sidebar">
        <nav className="admin-nav" aria-label="Admin sections">
          <button className={`admin-link ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LayoutDashboard size={16} /> <span>Dashboard</span>
          </button>
          <button className={`admin-link ${tab==='analytics'?'active':''}`} onClick={()=>setTab('analytics')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LayoutDashboard size={16} /> <span>Analytics</span>
          </button>
          <button className={`admin-link ${tab==='users'?'active':''}`} onClick={()=>setTab('users')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <UsersIcon size={16} /> <span>Users</span>
          </button>
          <button className={`admin-link ${tab==='pending'?'active':''}`} onClick={()=>setTab('pending')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Newspaper size={16} /> <span>Pending Posts {pending.length?`(${pending.length})`:''}</span>
          </button>
          <button className={`admin-link ${tab==='categories'?'active':''}`} onClick={()=>setTab('categories')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Folder size={16} /> <span>Categories</span>
          </button>
          <button className={`admin-link ${tab==='applications'?'active':''}`} onClick={()=>setTab('applications')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ClipboardCheck size={16} /> <span>Applications {apps.length?`(${apps.length})`:''}</span>
          </button>
          <button className={`admin-link ${tab==='reports'?'active':''}`} onClick={()=>setTab('reports')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Flag size={16} /> <span>Reports {reports.filter(r=>r.status==='open').length?`(${reports.filter(r=>r.status==='open').length})`:''}</span>
          </button>
          <button className={`admin-link ${tab==='newsletter'?'active':''}`} onClick={()=>setTab('newsletter')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Newspaper size={16} /> <span>Newsletter</span>
          </button>
          <button className={`admin-link ${tab==='contact'?'active':''}`} onClick={()=>setTab('contact')} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Mail size={16} /> <span>Contact</span>
          </button>
          <div className="muted" style={{ margin:'12px 4px 4px', fontSize:'.85rem' }}>Quick links</div>
          <Link className="admin-link" to="/editor">New Post</Link>
          <Link className="admin-link" to="/admin/library">Library</Link>
          <Link className="admin-link" to="/dashboard">Author Dashboard</Link>
          <Link className="admin-link" to="/profile">Profile</Link>
          <Link className="admin-link" to="/">Home</Link>
        </nav>
        </aside>
        <main className="admin-content">
          {tab==='dashboard' && (loading ? <DashboardSkeleton /> : <DashboardView />)}
          {tab==='analytics' && <AdminAnalytics />}
          {tab==='users' && (loading ? <TableSkeleton rows={6} cols={5} /> : <UsersView />)}
          {tab==='pending' && (loading ? <TableSkeleton rows={4} cols={3} /> : <PendingView />)}
          {tab==='categories' && (loading ? <TableSkeleton rows={5} cols={3} /> : <CategoriesView />)}
          {tab==='applications' && (loading ? <TableSkeleton rows={5} cols={4} /> : <ApplicationsView />)}
          {tab==='reports' && (loading ? <TableSkeleton rows={6} cols={6} /> : <ReportsView />)}
          {tab==='newsletter' && (loading ? <TableSkeleton rows={5} cols={2} /> : <NewsletterView />)}
          {tab==='contact' && (loading ? <TableSkeleton rows={6} cols={4} /> : <ContactView />)}
        </main>
        {userDrawerOpen && userDrawerUser && (
          <div className="drawer-overlay" onClick={closeUserDrawer} role="dialog" aria-modal="true">
            <div className="drawer-card" onClick={(e)=>e.stopPropagation()}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>User Details</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn" onClick={closeUserDrawer}>Close</button>
                </div>
              </div>
              <div className="section-card" style={{ marginBottom: 12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', flexDirection:'column' }}>
                    <strong>{userDrawerUser.name || 'User'}</strong>
                    <span className="muted" style={{ fontSize: '.9rem' }}>{userDrawerUser.email}</span>
                  </div>
                  <span className={`badge ${userDrawerUser.is_banned ? 'pending' : 'published'}`}>{userDrawerUser.is_banned ? 'banned' : 'active'}</span>
                </div>
                <div className="muted" style={{ fontSize: '.85rem', marginTop: 6 }}>Joined: {userDrawerUser.created_at ? new Date(userDrawerUser.created_at).toLocaleString() : '-'}</div>
              </div>

              <div className="form" style={{ marginBottom: 12 }}>
                <label>Role</label>
                <select value={userDrawerRole} onChange={(e)=>setUserDrawerRole(e.target.value)}>
                  <option value="reader">reader</option>
                  <option value="author">author</option>
                  <option value="admin">admin</option>
                </select>
                <div className="card-actions" style={{ justifyContent:'flex-end' }}>
                  <button className="btn" onClick={async()=>{ await setRole(userDrawerUser.id, userDrawerRole); closeUserDrawer() }}>Apply Role</button>
                </div>
              </div>

              <div className="card-actions" style={{ justifyContent:'space-between' }}>
                <button className="btn" onClick={async()=>{ await request(`/admin/users/${userDrawerUser.id}/ban`, { method:'PUT', body: JSON.stringify({ banned: !userDrawerUser.is_banned }), noGlobalLoading: true }); ui.notify(userDrawerUser.is_banned?'Unbanned':'Banned','success'); load(); closeUserDrawer() }}>{userDrawerUser.is_banned?'Unban user':'Ban user'}</button>
                <button className="btn" onClick={async()=>{ if (confirm('Delete this user? This cannot be undone.')) { await request(`/admin/users/${userDrawerUser.id}`, { method:'DELETE', noGlobalLoading: true }); ui.notify('User deleted','success'); load(); closeUserDrawer() } }}>Delete</button>
              </div>
            </div>
          </div>
        )}
        {previewOpen && (
          <div className="modal-overlay" onClick={closePreview} role="dialog" aria-modal="true">
            <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Preview</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn" onClick={openPrevPreview} disabled={previewIndex <= 0}>Prev</button>
                  <button className="btn" onClick={openNextPreview} disabled={previewIndex < 0 || previewIndex >= pending.length - 1}>Next</button>
                  <button className="btn" onClick={closePreview}>Close</button>
                </div>
              </div>
              <div className="muted" style={{ fontSize: '.85rem', marginBottom: 8 }}>Shortcuts: ←/→ navigate • A approve • S schedule • R reject • Esc close</div>
              {previewLoading ? (
                <div className="skeleton">
                  <div className="skeleton-line w-80" style={{ height: '24px', marginBottom: '8px' }} />
                  <div className="skeleton-line w-60" style={{ height: '14px', marginBottom: '16px' }} />
                  <div className="skeleton-thumb" style={{ width: '100%', height: '180px', marginBottom: '16px' }} />
                  <div className="skeleton-line" />
                  <div className="skeleton-line w-80" />
                  <div className="skeleton-line w-60" />
                </div>
              ) : previewArticle ? (
                <div>
                  <h3 style={{ marginTop: 0 }}>{previewArticle.title}</h3>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 12 }}>
                    {previewArticle.author?.avatar_url ? (
                      <img className="avatar" src={previewArticle.author.avatar_url} alt={previewArticle.author?.name||'Author'} />
                    ) : (
                      <span className="avatar-fallback">{(previewArticle.author?.name || 'A').slice(0,1).toUpperCase()}</span>
                    )}
                    <div className="muted" style={{ fontSize: '.9rem' }}>{previewArticle.author?.name || previewArticle.author_id}</div>
                  </div>
                  {previewArticle.thumbnail_url && (
                    <img src={previewArticle.thumbnail_url} alt="thumb" className="hero-thumb" style={{ height: 200 }} />
                  )}
                  <div className="markdown" style={{ marginTop: 12 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[[rehypeSanitize, {
                        ...defaultSchema,
                        attributes: {
                          ...(defaultSchema.attributes || {}),
                          code: [ ...(defaultSchema.attributes?.code || []), ['className'] ],
                          pre: [ ...(defaultSchema.attributes?.pre || []), ['className'] ],
                        }
                      }], rehypeHighlight]}
                    >
                      {previewArticle.content || ''}
                    </ReactMarkdown>
                  </div>
                  <div className="form" style={{ marginTop: 12 }}>
                    <label className="muted" htmlFor="schedAt">Schedule publish at</label>
                    <input id="schedAt" type="datetime-local" value={scheduleAt} onChange={(e)=>setScheduleAt(e.target.value)} />
                  </div>
                  <div className="form" style={{ marginTop: 12 }}>
                    <label className="muted" htmlFor="rejNotes">Decision notes (optional)</label>
                    <textarea id="rejNotes" placeholder="Reason for rejection..." value={rejectReason} onChange={(e)=>setRejectReason(e.target.value)} />
                  </div>
                  <div className="card-actions" style={{ justifyContent:'flex-end' }}>
                    <button className="btn" onClick={()=> approveScheduled(previewArticle.id, scheduleAt)} disabled={!scheduleAt}>Schedule</button>
                    <button className="btn btn-primary" onClick={()=>{ approve(previewArticle.id); closePreview() }}>Approve</button>
                    <button className="btn" onClick={()=>{ reject(previewArticle.id, rejectReason); closePreview() }}>Reject</button>
                    <button className="btn" onClick={()=>{ deleteArticle(previewArticle.id); closePreview() }}>Delete</button>
                  </div>
                </div>
              ) : (
                <div className="muted">Failed to load preview.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
