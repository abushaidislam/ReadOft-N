import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

const router = express.Router()

// List users (basic info)
router.get('/users', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_banned, is_verified, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list users' })
  }
})

// Verify/unverify user (for author badges)
router.put('/users/:id/verify', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const verified = !!req.body?.verified
    const { data, error } = await supabase
      .from('users')
      .update({ is_verified: verified })
      .eq('id', req.params.id)
      .select('id, name, is_verified')
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to update verification' })
  }
})

// Update user role
router.put('/users/:id/role', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { role } = req.body
    if (!Object.values(ROLES).includes(role)) return res.status(400).json({ message: 'Invalid role' })
    const { data, error } = await supabase.from('users').update({ role }).eq('id', req.params.id).select('id, email, name, role').single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to update role' })
  }
})

// Ban/unban user
router.put('/users/:id/ban', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const banned = !!req.body?.banned
    const { data, error } = await supabase.from('users').update({ is_banned: banned }).eq('id', req.params.id).select('id, name, is_banned').single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to update ban state' })
  }
})

// Delete user (cascades due to foreign keys)
router.delete('/users/:id', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to delete user' })
  }
})

// List pending articles for approval
router.get('/articles/pending', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const select = `id,title,author_id,slug,thumbnail_url,created_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    const { data, error } = await supabase
      .from('articles')
      .select(select)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list pending' })
  }
})

// Author role applications via notifications
router.get('/author-requests', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, payload, is_read, created_at')
      .eq('type', 'author_role_request')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list applications' })
  }
})

router.post('/author-requests/:id/approve', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data: notif, error: nErr } = await supabase
      .from('notifications')
      .select('id, payload')
      .eq('id', id)
      .eq('type', 'author_role_request')
      .maybeSingle()
    if (nErr) throw nErr
    if (!notif) return res.status(404).json({ message: 'Request not found' })
    const uid = notif.payload?.user_id
    if (!uid) return res.status(400).json({ message: 'Invalid payload' })
    const { error: uErr } = await supabase.from('users').update({ role: 'author' }).eq('id', uid)
    if (uErr) throw uErr
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    try { await notify(uid, 'author_role_granted', {}) } catch {}
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to approve application' })
  }
})

router.post('/author-requests/:id/reject', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : ''
    const { data: notif, error: nErr } = await supabase
      .from('notifications')
      .select('id, payload')
      .eq('id', id)
      .eq('type', 'author_role_request')
      .maybeSingle()
    if (nErr) throw nErr
    if (!notif) return res.status(404).json({ message: 'Request not found' })
    const uid = notif.payload?.user_id
    if (!uid) return res.status(400).json({ message: 'Invalid payload' })
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    try { await notify(uid, 'author_role_rejected', { reason }) } catch {}
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to reject application' })
  }
})

// Analytics endpoints
router.get('/analytics/overview', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const [users, articles, comments, views] = await Promise.all([
      supabase.from('users').select('id, created_at, role').order('created_at', { ascending: false }),
      supabase.from('articles').select('id, created_at, status').order('created_at', { ascending: false }),
      supabase.from('comments').select('id, created_at').order('created_at', { ascending: false }),
      supabase.from('article_views').select('id, created_at').order('created_at', { ascending: false })
    ])

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const stats = {
      totalUsers: users.data?.length || 0,
      totalArticles: articles.data?.length || 0,
      totalComments: comments.data?.length || 0,
      totalViews: views.data?.length || 0,
      publishedArticles: articles.data?.filter(a => a.status === 'published').length || 0,
      pendingArticles: articles.data?.filter(a => a.status === 'pending').length || 0,
      authorsCount: users.data?.filter(u => u.role === 'author').length || 0,
      adminsCount: users.data?.filter(u => u.role === 'admin').length || 0,
      
      // Growth metrics
      newUsersLast30Days: users.data?.filter(u => new Date(u.created_at) >= last30Days).length || 0,
      newUsersLast7Days: users.data?.filter(u => new Date(u.created_at) >= last7Days).length || 0,
      newUsersYesterday: users.data?.filter(u => new Date(u.created_at) >= yesterday && new Date(u.created_at) < new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)).length || 0,
      
      newArticlesLast30Days: articles.data?.filter(a => new Date(a.created_at) >= last30Days).length || 0,
      newArticlesLast7Days: articles.data?.filter(a => new Date(a.created_at) >= last7Days).length || 0,
      newArticlesYesterday: articles.data?.filter(a => new Date(a.created_at) >= yesterday && new Date(a.created_at) < new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)).length || 0,
      
      viewsLast30Days: views.data?.filter(v => new Date(v.created_at) >= last30Days).length || 0,
      viewsLast7Days: views.data?.filter(v => new Date(v.created_at) >= last7Days).length || 0,
      viewsYesterday: views.data?.filter(v => new Date(v.created_at) >= yesterday && new Date(v.created_at) < new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)).length || 0
    }

    res.json(stats)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to get analytics overview' })
  }
})

router.get('/analytics/charts', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const [users, articles, views] = await Promise.all([
      supabase.from('users').select('created_at, role').order('created_at', { ascending: true }),
      supabase.from('articles').select('id, title, slug, created_at, status, author_id').order('created_at', { ascending: true }),
      supabase.from('article_views').select('article_id, created_at').order('created_at', { ascending: true })
    ])

    // Generate last 30 days data
    const last30Days = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayUsers = users.data?.filter(u => u.created_at.startsWith(dateStr)).length || 0
      const dayArticles = articles.data?.filter(a => a.created_at.startsWith(dateStr) && a.status === 'published').length || 0
      const dayViews = views.data?.filter(v => v.created_at.startsWith(dateStr)).length || 0
      
      last30Days.push({
        date: dateStr,
        users: dayUsers,
        articles: dayArticles,
        views: dayViews
      })
    }

    // Top articles by views (compute from article_views)
    const viewCounts = {}
    for (const v of (views.data || [])) {
      const aid = v.article_id
      if (!aid) continue
      viewCounts[aid] = (viewCounts[aid] || 0) + 1
    }
    // Join with published articles
    const published = (articles.data || []).filter(a => a.status === 'published')
    const joined = published.map(a => ({ id: a.id, title: a.title, slug: a.slug, author_id: a.author_id, views_count: viewCounts[a.id] || 0 }))
    joined.sort((a, b) => (b.views_count - a.views_count))
    const topJoined = joined.slice(0, 10)
    // Fetch author names for display
    const authorIds = Array.from(new Set(topJoined.map(a => a.author_id).filter(Boolean)))
    let authorMap = {}
    if (authorIds.length) {
      const { data: authorRows } = await supabase.from('users').select('id, name').in('id', authorIds)
      authorMap = Object.fromEntries((authorRows || []).map(r => [r.id, r.name]))
    }
    const topArticles = topJoined.map(a => ({ id: a.id, title: a.title, slug: a.slug, views_count: a.views_count, author: { name: authorMap[a.author_id] || 'Unknown' } }))

    // User role distribution
    const roleDistribution = {
      readers: users.data?.filter(u => u.role === 'reader').length || 0,
      authors: users.data?.filter(u => u.role === 'author').length || 0,
      admins: users.data?.filter(u => u.role === 'admin').length || 0
    }

    res.json({
      dailyStats: last30Days,
      topArticles: topArticles || [],
      roleDistribution
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to get analytics charts' })
  }
})

router.get('/analytics/realtime', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last72Hours = new Date(now.getTime() - 72 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    const [recentViews, recentUsers, recentComments] = await Promise.all([
      supabase.from('article_views').select('created_at, article:articles!article_views_article_id_fkey(title, slug)').gte('created_at', last24Hours.toISOString()).order('created_at', { ascending: false }).limit(20),
      supabase.from('users').select('name, email, created_at').gte('created_at', last24Hours.toISOString()).order('created_at', { ascending: false }).limit(10),
      supabase.from('comments').select('id, content, created_at, author:users!comments_user_id_fkey(name), article:articles!comments_article_id_fkey(title, slug)').gte('created_at', last72Hours.toISOString()).order('created_at', { ascending: false }).limit(20)
    ])

    const hourlyViews = []
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      const count = recentViews.data?.filter(v => {
        const viewTime = new Date(v.created_at)
        return viewTime >= hourStart && viewTime < hourEnd
      }).length || 0
      
      hourlyViews.push({
        hour: hourStart.getHours(),
        views: count
      })
    }

    res.json({
      recentViews: recentViews.data || [],
      recentUsers: recentUsers.data || [],
      recentComments: recentComments.data || [],
      hourlyViews,
      activeUsersLastHour: recentViews.data?.filter(v => new Date(v.created_at) >= lastHour).length || 0
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to get realtime analytics' })
  }
})

// System health: basic table counts
router.get('/health', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const tables = ['users', 'articles', 'comments', 'article_views', 'reports']
    const counts = {}
    for (const t of tables) {
      try {
        const { count, error } = await supabase.from(t).select('id', { count: 'exact', head: true })
        if (error) throw error
        counts[t] = count || 0
      } catch (e) {
        counts[t] = null
      }
    }
    res.json({ status: 'ok', at: new Date(), counts })
  } catch (e) {
    console.error('health error', e)
    res.status(500).json({ status: 'error' })
  }
})

// Categories usage stats (counts of articles per category)
router.get('/categories/stats', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('categories')
    if (error) throw error
    const counts = {}
    for (const row of (data || [])) {
      const cats = Array.isArray(row.categories) ? row.categories : []
      for (const c of cats) counts[c] = (counts[c] || 0) + 1
    }
    res.json(counts)
  } catch (e) {
    console.error('categories stats error', e)
    res.status(500).json({ message: 'Failed to load category stats' })
  }
})

export default router
