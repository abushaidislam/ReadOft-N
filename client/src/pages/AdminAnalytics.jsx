import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import { LineChart, BarChart, DonutChart } from '../components/AnalyticsChart.jsx'

export default function AdminAnalytics() {
  const { request } = useAuth()
  const [overview, setOverview] = useState(null)
  const [charts, setCharts] = useState(null)
  const [realtime, setRealtime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [_refreshInterval, setRefreshInterval] = useState(null)

  const loadData = async () => {
    try {
      const [overviewData, chartsData, realtimeData] = await Promise.all([
        request('/admin/analytics/overview'),
        request('/admin/analytics/charts'),
        request('/admin/analytics/realtime')
      ])
      setOverview(overviewData)
      setCharts(chartsData)
      setRealtime(realtimeData)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData().catch(console.error)
    }, 30000)
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, []) // loadData is stable, no need to include

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num?.toString() || '0'
  }

  // Utility function for future growth calculations
  // const calculateGrowth = (current, previous) => {
  //   if (!previous) return 0
  //   return ((current - previous) / previous * 100).toFixed(1)
  // }

  if (loading) {
    return (
      <div className="container page">
        <div className="global-loader">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container page">
        <h2>Analytics</h2>
        <div className="error">Error loading analytics: {error}</div>
        <button className="btn btn-primary" onClick={loadData}>Retry</button>
      </div>
    )
  }

  return (
    <div className="container page">
      <div className="page-head">
        <h2>Analytics Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '0.9rem' }}>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
          <button className="btn" onClick={loadData}>Refresh</button>
        </div>
      </div>

      {/* Overview Stats */}
      <section className="section-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Overview</h3>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="stat">
            <div className="value">{formatNumber(overview?.totalUsers)}</div>
            <div className="label">Total Users</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              +{overview?.newUsersLast7Days || 0} this week
            </div>
          </div>
          <div className="stat">
            <div className="value">{formatNumber(overview?.totalArticles)}</div>
            <div className="label">Total Articles</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              {overview?.publishedArticles || 0} published
            </div>
          </div>
          <div className="stat">
            <div className="value">{formatNumber(overview?.totalViews)}</div>
            <div className="label">Total Views</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              +{overview?.viewsLast7Days || 0} this week
            </div>
          </div>
          <div className="stat">
            <div className="value">{formatNumber(overview?.totalComments)}</div>
            <div className="label">Comments</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              All time
            </div>
          </div>
          <div className="stat">
            <div className="value">{overview?.authorsCount || 0}</div>
            <div className="label">Authors</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              {overview?.adminsCount || 0} admins
            </div>
          </div>
          <div className="stat">
            <div className="value">{overview?.pendingArticles || 0}</div>
            <div className="label">Pending</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Need review
            </div>
          </div>
        </div>
      </section>

      <div className="grid two" style={{ gap: '24px', marginBottom: '24px' }}>
        {/* Growth Chart */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Daily Activity (Last 30 Days)</h3>
          {charts?.dailyStats && (
            <div style={{ marginBottom: '16px' }}>
              <div className="chips" style={{ marginBottom: '12px' }}>
                <span className="chip" style={{ background: 'rgba(99,102,241,0.1)', borderColor: '#6366f1' }}>
                  Users
                </span>
                <span className="chip" style={{ background: 'rgba(16,185,129,0.1)', borderColor: '#10b981' }}>
                  Articles
                </span>
                <span className="chip" style={{ background: 'rgba(245,158,11,0.1)', borderColor: '#f59e0b' }}>
                  Views
                </span>
              </div>
              <LineChart 
                data={charts.dailyStats.map(d => ({ 
                  value: d.users + d.articles + d.views, 
                  label: new Date(d.date).getDate() 
                }))}
                width={400}
                height={200}
                color="#6366f1"
              />
            </div>
          )}
        </section>

        {/* User Roles Distribution */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>User Roles</h3>
          {charts?.roleDistribution && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <DonutChart 
                data={[
                  { label: 'Readers', value: charts.roleDistribution.readers },
                  { label: 'Authors', value: charts.roleDistribution.authors },
                  { label: 'Admins', value: charts.roleDistribution.admins }
                ]}
                width={160}
                height={160}
                colors={['#6366f1', '#10b981', '#f59e0b']}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#6366f1', borderRadius: '2px' }}></div>
                    <span>Readers: {charts.roleDistribution.readers}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
                    <span>Authors: {charts.roleDistribution.authors}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px' }}></div>
                    <span>Admins: {charts.roleDistribution.admins}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid two" style={{ gap: '24px', marginBottom: '24px' }}>
        {/* Top Articles */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Top Articles by Views</h3>
          <div className="media-list">
            {charts?.topArticles?.slice(0, 8).map((article, index) => (
              <div key={article.id} className="media-item">
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  background: '#6366f1', 
                  borderRadius: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {index + 1}
                </div>
                <div className="media-body">
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {article.title}
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    by {article.author?.name || 'Unknown'} • {formatNumber(article.views_count)} views
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hourly Views */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Hourly Views (Last 24h)</h3>
          {realtime?.hourlyViews && (
            <div style={{ marginBottom: '16px' }}>
              <div className="muted" style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
                Active users last hour: {realtime.activeUsersLastHour}
              </div>
              <BarChart 
                data={realtime.hourlyViews.map(h => ({ 
                  label: h.hour + 'h', 
                  value: h.views 
                }))}
                width={400}
                height={180}
                color="#10b981"
              />
            </div>
          )}
        </section>
      </div>

      {/* Real-time Activity */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Recent Views */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Recent Views</h3>
          <div className="media-list">
            {realtime?.recentViews?.slice(0, 6).map((view, index) => (
              <div key={index} className="media-item">
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#10b981', 
                  borderRadius: '50%',
                  marginTop: '6px'
                }}></div>
                <div className="media-body">
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {view.article?.title || 'Unknown Article'}
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {new Date(view.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Users */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>New Users (24h)</h3>
          <div className="media-list">
            {realtime?.recentUsers?.slice(0, 6).map((user, index) => (
              <div key={index} className="media-item">
                <div className="avatar-fallback" style={{ width: '32px', height: '32px' }}>
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="media-body">
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {user.name || 'New User'}
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {user.email} • {new Date(user.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Comments */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Recent Comments</h3>
          <div className="media-list">
            {realtime?.recentComments?.slice(0, 6).map((comment, index) => (
              <div key={index} className="media-item">
                <div className="avatar-fallback" style={{ width: '32px', height: '32px' }}>
                  {(comment.author?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="media-body">
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {comment.author?.name || 'Anonymous'}
                  </div>
                  <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                    {comment.content?.slice(0, 60)}...
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    on {comment.article?.title?.slice(0, 30)}... • {new Date(comment.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
