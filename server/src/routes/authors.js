import express from 'express'
import { supabase } from '../supabase.js'

const router = express.Router()

// Search authors by name (public)
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5))
    if (!q) return res.json([])
    let query = supabase
      .from('users')
      .select('id,name,avatar_url,role', { count: 'exact' })
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(limit)
    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('authors search error:', e)
    res.status(500).json({ message: 'Failed to search authors' })
  }
})

// List authors (paginated) — place BEFORE param routes
router.get('/list', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12))
    const start = (page - 1) * limit
    const end = start + limit - 1
    const sortParam = String(req.query.sort || '-created_at')
    const desc = sortParam.startsWith('-')
    const sortKey = (desc ? sortParam.slice(1) : sortParam)
    const allowed = ['created_at', 'name']
    const orderKey = allowed.includes(sortKey) ? sortKey : 'created_at'
    const withFollowers = String(req.query.with_followers || '') === '1'

    const { data, error, count } = await supabase
      .from('users')
      .select('id, name, avatar_url, bio, role, created_at', { count: 'exact' })
      .eq('role', 'author')
      .order(orderKey, { ascending: !desc })
      .range(start, end)

    if (error) throw error
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    let items = data || []
    if (withFollowers && items.length > 0) {
      const ids = items.map((u) => u.id)
      const { data: rows, error: fErr } = await supabase
        .from('user_follows')
        .select('author_id')
        .in('author_id', ids)
      if (fErr) throw fErr
      const counts = {}
      for (const r of (rows || [])) counts[r.author_id] = (counts[r.author_id] || 0) + 1
      items = items.map((u) => ({ ...u, follower_count: counts[u.id] || 0 }))
    }
    // Attach posts_count and latest_article for these authors
    if (items.length > 0) {
      const ids = items.map((u) => u.id)
      let arts = null
      let aErr = null
      try {
        const res = await supabase
          .from('articles')
          .select('id, author_id, title, slug, created_at, views_count, categories')
          .in('author_id', ids)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(500)
        arts = res.data
        aErr = res.error
      } catch (e) {
        aErr = e
      }
      if (aErr) {
        // Fallback if views_count column does not exist
        if (aErr.code === '42703' || /views_count/i.test(String(aErr.message || ''))) {
          const res2 = await supabase
            .from('articles')
            .select('id, author_id, title, slug, created_at, categories')
            .in('author_id', ids)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(500)
          arts = res2.data
          if (res2.error) throw res2.error
        } else {
          throw aErr
        }
      }
      const postsMap = {}
      const latestMap = {}
      for (const a of (arts || [])) {
        postsMap[a.author_id] = (postsMap[a.author_id] || 0) + 1
        if (!latestMap[a.author_id]) latestMap[a.author_id] = a
      }
      // Map category slugs to names for latest articles
      let catMap = {}
      try {
        const allSlugs = Array.from(new Set((Object.values(latestMap) || []).flatMap((x) => Array.isArray(x.categories) ? x.categories : [])))
        if (allSlugs.length > 0) {
          const { data: catRows, error: cErr } = await supabase
            .from('categories')
            .select('slug, name')
            .in('slug', allSlugs)
          if (cErr) throw cErr
          catMap = Object.fromEntries((catRows || []).map((r) => [r.slug, r.name]))
        }
      } catch (e) {
        // best-effort; keep slugs if categories table missing
      }
      items = items.map((u) => ({
        ...u,
        posts_count: postsMap[u.id] || 0,
        latest_article: latestMap[u.id]
          ? { id: latestMap[u.id].id, title: latestMap[u.id].title, slug: latestMap[u.id].slug, created_at: latestMap[u.id].created_at, views_count: latestMap[u.id].views_count || 0, categories: (latestMap[u.id].categories || []).map((s) => catMap[s] || s) }
          : null
      }))
    }
    res.json({ items, pageInfo: { page, pageSize: limit, total, totalPages, sort: sortParam } })
  } catch (e) {
    console.error('authors list error:', e)
    res.status(500).json({ message: 'Failed to list authors' })
  }
})

// Top authors (by followers) — place BEFORE param routes
router.get('/top', async (req, res) => {
  try {
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit) || 12))
    // Compute follower counts per author
    const { data: rows, error: fErr } = await supabase
      .from('user_follows')
      .select('author_id')
    if (fErr) throw fErr
    const counts = {}
    for (const r of (rows || [])) counts[r.author_id] = (counts[r.author_id] || 0) + 1
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit)
    const topIds = sorted.map(([id]) => id)
    if (topIds.length === 0) return res.json([])
    const { data: authors, error: aErr } = await supabase
      .from('users')
      .select('id, name, avatar_url, bio')
      .in('id', topIds)
    if (aErr) throw aErr
    const map = Object.fromEntries(sorted)
    let items = (authors || [])
      .map((u) => ({ ...u, follower_count: map[u.id] || 0 }))

    // Attach posts_count and latest_article similar to /list
    let arts = null
    let artsErr = null
    try {
      const res = await supabase
        .from('articles')
        .select('id, author_id, title, slug, created_at, views_count, categories')
        .in('author_id', topIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(500)
      arts = res.data
      artsErr = res.error
    } catch (e) {
      artsErr = e
    }
    if (artsErr) {
      if (artsErr.code === '42703' || /views_count/i.test(String(artsErr.message || ''))) {
        const res2 = await supabase
          .from('articles')
          .select('id, author_id, title, slug, created_at, categories')
          .in('author_id', topIds)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(500)
        arts = res2.data
        if (res2.error) throw res2.error
      } else {
        throw artsErr
      }
    }
    const postsMap = {}
    const latestMap = {}
    for (const a of (arts || [])) {
      postsMap[a.author_id] = (postsMap[a.author_id] || 0) + 1
      if (!latestMap[a.author_id]) latestMap[a.author_id] = a
    }
    // Map category slugs to names for latest articles
    let catMap = {}
    try {
      const allSlugs = Array.from(new Set((Object.values(latestMap) || []).flatMap((x) => Array.isArray(x.categories) ? x.categories : [])))
      if (allSlugs.length > 0) {
        const { data: catRows, error: cErr } = await supabase
          .from('categories')
          .select('slug, name')
          .in('slug', allSlugs)
        if (cErr) throw cErr
        catMap = Object.fromEntries((catRows || []).map((r) => [r.slug, r.name]))
      }
    } catch (e) {
      // best-effort; keep slugs if categories table missing
    }
    items = items.map((u) => ({
      ...u,
      posts_count: postsMap[u.id] || 0,
      latest_article: latestMap[u.id]
        ? { id: latestMap[u.id].id, title: latestMap[u.id].title, slug: latestMap[u.id].slug, created_at: latestMap[u.id].created_at, views_count: latestMap[u.id].views_count || 0, categories: (latestMap[u.id].categories || []).map((s) => catMap[s] || s) }
        : null
    }))

    items.sort((a,b)=> (b.follower_count - a.follower_count))
    res.json(items)
  } catch (e) {
    console.error('authors top error:', e)
    res.status(500).json({ message: 'Failed to load top authors' })
  }
})

// Basic author profile
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, bio, avatar_url, role, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!user) return res.status(404).json({ message: 'Author not found' })
    res.json(user)
  } catch (e) {
    console.error('author profile error', e)
    res.status(500).json({ message: 'Failed to load author' })
  }
})

// Author summary: counts for posts (published), likes sum, followers count
router.get('/:id/summary', async (req, res) => {
  try {
    const authorId = req.params.id
    // Author info
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, name, bio, avatar_url, role, created_at')
      .eq('id', authorId)
      .maybeSingle()
    if (uErr) throw uErr
    if (!user) return res.status(404).json({ message: 'Author not found' })

    // Posts count (published)
    const { count: posts, error: cErr } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', authorId)
      .eq('status', 'published')
    if (cErr) throw cErr

    // Likes sum (published)
    const { data: likesRows, error: lErr } = await supabase
      .from('articles')
      .select('like_count')
      .eq('author_id', authorId)
      .eq('status', 'published')
    if (lErr) throw lErr
    const likes = (likesRows || []).reduce((acc, r) => acc + (r.like_count || 0), 0)

    // Followers count
    const { count: followers, error: fErr } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', authorId)
    if (fErr) throw fErr

    res.json({ user, counts: { posts: posts || 0, likes, followers: followers || 0 } })
  } catch (e) {
    console.error('author summary error', e)
    res.status(500).json({ message: 'Failed to load author summary' })
  }
})

// List authors (paginated)
// (moved /list and /top above param routes to avoid conflicts)

export default router
