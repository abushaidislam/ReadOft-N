import express from 'express'
import { supabase } from '../supabase.js'

const router = express.Router()

// Full-text search over published articles
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json({ items: [], pageInfo: { page: 1, pageSize: 0, total: 0, totalPages: 1, sort: '-created_at' } })
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12))
    const start = (page - 1) * limit
    const end = start + limit - 1
    const sortParam = String(req.query.sort || '-created_at')
    const desc = sortParam.startsWith('-')
    const sortKey = (desc ? sortParam.slice(1) : sortParam)
    const allowedSort = ['created_at', 'like_count', 'title']
    const orderKey = allowedSort.includes(sortKey) ? sortKey : 'created_at'

    // optional period filter
    const period = String(req.query.period || '').toLowerCase()
    let fromDate = null
    if (period === 'today') {
      const d = new Date(); d.setHours(0,0,0,0); fromDate = d
    } else if (period === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7); fromDate = d
    } else if (period === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30); fromDate = d
    }

    const select = `id,slug,title,content,author_id,status,tags,categories,thumbnail_url,thumbnail_path,like_count,created_at,updated_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    let query = supabase
      .from('articles')
      .select(select, { count: 'exact' })
      .eq('status', 'published')
      .textSearch('search', q, { type: 'websearch', config: 'english' })
      .order(orderKey, { ascending: !desc })
      .range(start, end)
    if (fromDate) query = query.gte('created_at', fromDate.toISOString())
    const { data, error, count } = await query
    if (error) throw error
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    res.json({ items: data || [], pageInfo: { page, pageSize: limit, total, totalPages, sort: sortParam, period: period || '' } })
  } catch (e) {
    console.error('Search error:', e)
    res.status(500).json({ message: 'Search failed' })
  }
})

export default router
