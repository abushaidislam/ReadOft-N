import { useCallback, useEffect, useState } from 'react'
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

  // Advanced analytics data
  const [advPeriod, setAdvPeriod] = useState('month') // 'week' | 'month' | 'all'
  const [advTopArticles, setAdvTopArticles] = useState([])
  const [advTopAuthors, setAdvTopAuthors] = useState([])
  const [advZeroViews, setAdvZeroViews] = useState([])

  const loadData = useCallback(async () => {
    try {
      const [overviewData, chartsData, realtimeData] = await Promise.all([
        request('/admin/analytics/overview', { noGlobalLoading: true }),
        request('/admin/analytics/charts', { noGlobalLoading: true }),
        request('/admin/analytics/realtime', { noGlobalLoading: true })
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
  }, [request])

  useEffect(() => {
    loadData().catch(console.error)
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData().catch(console.error)
    }, 30000)
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [loadData])

  // Load advanced analytics blocks
  const loadAdvanced = useCallback(async () => {
    try {
      const qs = `?period=${encodeURIComponent(advPeriod)}`
      const [ta, tu, zv] = await Promise.all([
        request(`/admin/analytics/top-articles${qs}`, { noGlobalLoading: true }).catch(() => []),
        request(`/admin/analytics/top-authors${qs}`, { noGlobalLoading: true }).catch(() => []),
        request(`/admin/analytics/zero-views${qs}`, { noGlobalLoading: true }).catch(() => []),
      ])
      setAdvTopArticles(Array.isArray(ta) ? ta : [])
      setAdvTopAuthors(Array.isArray(tu) ? tu : [])
      setAdvZeroViews(Array.isArray(zv) ? zv : [])
    } catch (e) {
      // keep silent, sections will show empty states
    }
  }, [request, advPeriod])

  useEffect(() => { loadAdvanced().catch(console.error) }, [loadAdvanced])

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num?.toString() || '0'
  }

  const timeAgo = (ts) => {
    const d = new Date(ts)
    const diff = Date.now() - d.getTime()
    const sec = Math.max(0, Math.floor(diff / 1000))
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    return `${day}d ago`
  }

  // Utility function for future growth calculations
  // const calculateGrowth = (current, previous) => {
  //   if (!previous) return 0
  //   return ((current - previous) / previous * 100).toFixed(1)
  // }

  if (loading) {
    return (
      <div className="container page">
        <div className="page-head">
          <div className="skeleton">
            <div className="skeleton-line w-40" style={{ height: '24px' }} />
          </div>
        </div>

        {/* Overview skeleton */}
        <section className="section-card" style={{ marginBottom: '24px' }}>
          <div className="skeleton">
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="stat">
                  <div className="skeleton-line w-60" style={{ height: '24px' }} />
                  <div className="skeleton-line w-50" style={{ height: '12px', marginTop: '6px' }} />
                  <div className="skeleton-line w-40" style={{ height: '10px', marginTop: '6px' }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Charts skeleton */}
        <div className="grid two" style={{ gap: '24px', marginBottom: '24px' }}>
          <section className="section-card">
            <div className="skeleton">
              <div className="skeleton-line w-60" style={{ height: '20px', marginBottom: '12px' }} />
              <div className="skeleton-thumb" style={{ width: '100%', height: '200px' }} />
            </div>
          </section>
          <section className="section-card">
            <div className="skeleton">
              <div className="skeleton-line w-60" style={{ height: '20px', marginBottom: '12px' }} />
              <div className="skeleton-thumb" style={{ width: '100%', height: '200px' }} />
            </div>
          </section>
        </div>

        {/* Lists skeleton */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {Array.from({ length: 3 }).map((_, k) => (
            <section key={k} className="section-card">
              <div className="skeleton">
                <div className="skeleton-line w-50" style={{ height: '20px', marginBottom: '12px' }} />
                {Array.from({ length: 6 }).map((__, i) => (
                  <div key={i} className="media-item">
                    <div className="skeleton-avatar" style={{ width: 32, height: 32 }} />
                    <div className="media-body" style={{ width: '100%' }}>
                      <div className="skeleton-line w-80" />
                      <div className="skeleton-line w-50" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
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

      {/* Advanced: Period-based rankings */}
      <section className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Top Articles by Views (Period)</h3>
          <div className="chips">
            {['week','month','all'].map(p => (
              <button key={p} className="chip" onClick={() => setAdvPeriod(p)} style={advPeriod===p ? { background:'rgba(99,102,241,.15)', borderColor:'#6366f1' } : undefined}>
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        <div className="media-list">
          {(advTopArticles||[]).slice(0, 10).map((article, index) => (
            <div key={article.id} className="media-item">
              <div style={{ 
                width: '24px', height: '24px', background: '#6366f1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold'
              }}>{index + 1}</div>
              <div className="media-body">
                <div style={{ fontWeight: 500 }}>{article.title}</div>
                <div className="muted" style={{ fontSize: '.85rem' }}>by {article.author?.name || 'Unknown'} • {formatNumber(article.views_count)} views</div>
              </div>
            </div>
          ))}
          {(!advTopArticles || advTopArticles.length === 0) && <div className="muted" style={{ fontSize: '.9rem' }}>No data</div>}
        </div>
      </section>

      <div className="grid two" style={{ gap: '24px', marginBottom: '24px' }}>
        {/* Advanced: Top Authors by Views (Period) */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Top Authors by Views ({advPeriod === 'week' ? 'This Week' : advPeriod === 'month' ? 'This Month' : 'All Time'})</h3>
          <div className="media-list">
            {(advTopAuthors||[]).slice(0, 10).map((u, i) => (
              <div key={u.id} className="media-item">
                {u.avatar_url ? (
                  <img className="avatar" src={u.avatar_url} alt={u.name} />
                ) : (
                  <div className="avatar-fallback" style={{ width:32, height:32 }}>{(u.name||'A').slice(0,1).toUpperCase()}</div>
                )}
                <div className="media-body">
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: '.85rem' }}>{formatNumber(u.views_count)} views</div>
                </div>
              </div>
            ))}
            {(!advTopAuthors || advTopAuthors.length === 0) && <div className="muted" style={{ fontSize: '.9rem' }}>No data</div>}
          </div>
        </section>

        {/* Advanced: Zero-View Articles (Period) */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Zero-View Articles ({advPeriod === 'week' ? 'This Week' : advPeriod === 'month' ? 'This Month' : 'All Time'})</h3>
          <div className="media-list">
            {(advZeroViews||[]).slice(0, 8).map((a) => (
              <div key={a.id} className="media-item">
                <div className="avatar-fallback" style={{ width: 24, height: 24 }}>{(a.author?.name || 'A').slice(0,1).toUpperCase()}</div>
                <div className="media-body">
                  <div style={{ fontWeight: 500 }}>{a.title}</div>
                  <div className="muted" style={{ fontSize: '.85rem' }}>by {a.author?.name || 'Unknown'} • {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
            {(!advZeroViews || advZeroViews.length === 0) && <div className="muted" style={{ fontSize: '.9rem' }}>Great! No zero-view articles.</div>}
          </div>
        </section>
      </div>

      {/* Views-only trend (Last 30 Days) */}
      <section className="section-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Views Trend (Last 30 Days)</h3>
        {charts?.dailyStats && (
          <div style={{ marginBottom: '16px' }}>
            <LineChart 
              data={charts.dailyStats.map(d => ({ 
                value: d.views,
                label: new Date(d.date).getDate()
              }))}
              width={400}
              height={200}
              color="#f59e0b"
            />
          </div>
        )}
      </section>

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
          <h3 style={{ marginTop: 0 }}>Recent Views (24h)</h3>
          {realtime?.recentViews?.length ? (
            <div className="media-list">
              {realtime.recentViews.slice(0, 6).map((view, index) => (
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
                      {timeAgo(view.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: '.9rem' }}>No recent views in the last 24 hours.</div>
          )}
        </section>

        {/* Recent Users */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>New Users (24h)</h3>
          {realtime?.recentUsers?.length ? (
            <div className="media-list">
              {realtime.recentUsers.slice(0, 6).map((user, index) => (
                <div key={index} className="media-item">
                  <div className="avatar-fallback" style={{ width: '32px', height: '32px' }}>
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="media-body">
                    <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                      {user.name || 'New User'}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {user.email} • {timeAgo(user.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: '.9rem' }}>No new users in the last 24 hours.</div>
          )}
        </section>

        {/* Recent Comments */}
        <section className="section-card">
          <h3 style={{ marginTop: 0 }}>Recent Comments (72h)</h3>
          {realtime?.recentComments?.length ? (
            <div className="media-list">
              {realtime.recentComments.slice(0, 6).map((comment, index) => (
                <div key={comment.id || index} className="media-item">
                  <div className="avatar-fallback" style={{ width: '32px', height: '32px' }}>
                    {(comment.author?.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="media-body">
                    <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                      {comment.author?.name || 'Anonymous'}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                      {(comment.content || '').slice(0, 60)}{(comment.content||'').length > 60 ? '…' : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      on {(comment.article?.title || 'Unknown').slice(0, 30)}{(comment.article?.title||'').length>30?'…':''} • {timeAgo(comment.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: '.9rem' }}>No recent comments in the last 72 hours.</div>
          )}
        </section>
      </div>
    </div>
  )
}
