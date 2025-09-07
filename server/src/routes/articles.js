import express from 'express'
import { supabase } from '../supabase.js'
import { randomUUID } from 'node:crypto'
import { authOptional, authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { validateArticle } from '../models/article.js'

const router = express.Router()

// Public: list published articles with optional filters
router.get('/', authOptional, async (req, res) => {
  try {
    const { tag, category, author_id, q } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12))
    const start = (page - 1) * limit
    const end = start + limit - 1

    // sort: e.g. -created_at, like_count, title
    const sortParam = String(req.query.sort || '-created_at')
    const desc = sortParam.startsWith('-')
    const sortKey = (desc ? sortParam.slice(1) : sortParam)
    const allowedSort = ['created_at', 'like_count', 'title']
    const orderKey = allowedSort.includes(sortKey) ? sortKey : 'created_at'

    // base query
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .order(orderKey, { ascending: !desc, nullsFirst: false })
      .range(start, end)
    const u = req.user
    const isOwnerView = author_id && (u?.id === author_id || u?.role === ROLES.ADMIN)
    if (!isOwnerView) {
      query = query.eq('status', 'published')
    }
    if (tag) query = query.contains('tags', [tag])
    if (category) query = query.contains('categories', [category])
    if (author_id) query = query.eq('author_id', author_id)
    if (q) query = query.ilike('title', `%${q}%`)
    const { data, error, count } = await query
    if (error) throw error
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    res.json({
      items: data || [],
      pageInfo: { page, pageSize: limit, total, totalPages, sort: sortParam },
    })
  } catch (e) {
    console.error('List articles error:', e)
    res.status(500).json({ message: 'Failed to list articles', error: e?.message || String(e) })
  }
})

// Get single article by id (published or owned by author/admin)
router.get('/:id', authOptional, async (req, res) => {
  try {
    const id = req.params.id
    const { data: article, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (article.status !== 'published') {
      const u = req.user
      if (!u || (u.id !== article.author_id && u.role !== ROLES.ADMIN)) return res.status(403).json({ message: 'Forbidden' })
    }
    res.json(article)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to fetch article' })
  }
})

// Author: create article (defaults to pending)
router.post('/', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const author_id = req.user.id
    const payload = {
      id: randomUUID(),
      title: req.body.title,
      content: req.body.content,
      author_id,
      status: req.body.status && ['draft', 'pending', 'published'].includes(req.body.status) ? req.body.status : 'pending',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      categories: Array.isArray(req.body.categories) ? req.body.categories : [],
      thumbnail_url: typeof req.body.thumbnail_url === 'string' ? req.body.thumbnail_url : '',
      thumbnail_path: typeof req.body.thumbnail_path === 'string' ? req.body.thumbnail_path : '',
      like_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }
    validateArticle(payload)
    const { data, error } = await supabase.from('articles').insert(payload).select('*').single()
    if (error) throw error
    res.status(201).json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Failed to create' })
  }
})

// Author/Admin: update own article
router.put('/:id', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data: existing, error: findErr } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
    if (findErr) throw findErr
    if (!existing) return res.status(404).json({ message: 'Not found' })
    if (req.user.role !== ROLES.ADMIN && existing.author_id !== req.user.id)
      return res.status(403).json({ message: 'Forbidden' })

    const patch = {
      title: req.body.title ?? existing.title,
      content: req.body.content ?? existing.content,
      tags: Array.isArray(req.body.tags) ? req.body.tags : existing.tags,
      categories: Array.isArray(req.body.categories) ? req.body.categories : existing.categories,
      thumbnail_url: typeof req.body.thumbnail_url === 'string' ? req.body.thumbnail_url : existing.thumbnail_url,
      thumbnail_path: typeof req.body.thumbnail_path === 'string' ? req.body.thumbnail_path : existing.thumbnail_path,
      status: req.body.status ?? existing.status,
      updated_at: new Date(),
    }
    validateArticle({ ...existing, ...patch })

    // if thumbnail changed, attempt to delete old asset
    if (patch.thumbnail_path !== existing.thumbnail_path && existing.thumbnail_path) {
      try {
        await supabase.storage.from('thumbnails').remove([existing.thumbnail_path])
      } catch {}
    }

    const { data, error } = await supabase.from('articles').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Failed to update' })
  }
})

// Author/Admin: delete article
router.delete('/:id', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data: existing, error: findErr } = await supabase.from('articles').select('id, author_id, thumbnail_path').eq('id', id).maybeSingle()
    if (findErr) throw findErr
    if (!existing) return res.status(404).json({ message: 'Not found' })
    if (req.user.role !== ROLES.ADMIN && existing.author_id !== req.user.id)
      return res.status(403).json({ message: 'Forbidden' })
    if (existing.thumbnail_path) {
      try {
        await supabase.storage.from('thumbnails').remove([existing.thumbnail_path])
      } catch {}
    }
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to delete' })
  }
})

// Admin: approve article
router.post('/:id/approve', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data, error } = await supabase.from('articles').update({ status: 'published', updated_at: new Date() }).eq('id', id).select('*').single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to approve' })
  }
})

export default router
