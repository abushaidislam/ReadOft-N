import { Link } from 'react-router-dom'

export default function AdminLayout({ tab, setTab, pendingCount = 0, appCount = 0, reportCount = 0, children }) {
  return (
    <div className="container page">
      <h2>Admin Panel</h2>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav className="admin-nav" aria-label="Admin sections">
            <button className={`admin-link ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={`admin-link ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
            <button className={`admin-link ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
              <span>Pending Posts</span>
              {pendingCount ? <span className="count">{pendingCount}</span> : null}
            </button>
            <button className={`admin-link ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
            <button className={`admin-link ${tab === 'applications' ? 'active' : ''}`} onClick={() => setTab('applications')}>
              <span>Applications</span>
              {appCount ? <span className="count">{appCount}</span> : null}
            </button>
            <button className={`admin-link ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
              <span>Reports</span>
              {reportCount ? <span className="count">{reportCount}</span> : null}
            </button>
            <div className="muted" style={{ margin: 'var(--space-12) var(--space-xs) var(--space-xs)', fontSize: '.85rem' }}>Quick links</div>
            <Link className="admin-link" to="/editor">New Post</Link>
            <Link className="admin-link" to="/dashboard">Author Dashboard</Link>
            <Link className="admin-link" to="/profile">Profile</Link>
            <Link className="admin-link" to="/">Home</Link>
          </nav>
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
