import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

// Personalized feed: published articles from followed authors
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12))
    const start = (page - 1) * limit
    const end = start + limit - 1

    const sortParam = String(req.query.sort || '-created_at')
    const desc = sortParam.startsWith('-')
    const sortKey = (desc ? sortParam.slice(1) : sortParam)
    const allowedSort = ['created_at', 'like_count', 'title']
    const orderKey = allowedSort.includes(sortKey) ? sortKey : 'created_at'

    // fetch followed authors
    const { data: follows, error: fErr } = await supabase
      .from('user_follows')
      .select('author_id')
      .eq('follower_id', userId)
    if (fErr) throw fErr

    const authorIds = (follows || []).map((r) => r.author_id)
    if (authorIds.length === 0) {
      return res.json({ items: [], pageInfo: { page, pageSize: limit, total: 0, totalPages: 1, sort: sortParam } })
    }

    const { data, error, count } = await supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .in('author_id', authorIds)
      .eq('status', 'published')
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order(orderKey, { ascending: !desc })
      .range(start, end)

    if (error) throw error
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    res.json({ items: data || [], pageInfo: { page, pageSize: limit, total, totalPages, sort: sortParam } })
  } catch (e) {
    console.error('Feed error:', e)
    res.status(500).json({ message: 'Failed to load feed' })
  }
})

export default router
