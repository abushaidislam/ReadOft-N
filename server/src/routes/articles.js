import express from 'express'
import { supabase } from '../supabase.js'
import { randomUUID } from 'node:crypto'
import { authOptional, authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { validateArticle } from '../models/article.js'
import { notify, notifyFollowersOfArticle, notifyAdminsOfPendingArticle } from '../utils/notify.js'
import { slugify, ensureUniqueSlug } from '../utils/slug.js'

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

    // optional period filter: today|week|month
    const period = String(req.query.period || '').toLowerCase()
    let fromDate = null
    if (period === 'today') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      fromDate = d
    } else if (period === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      fromDate = d
    } else if (period === 'month') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      fromDate = d
    }

    // base query with author join (minimal fields)
    const select = `id,slug,title,content,author_id,status,tags,categories,thumbnail_url,thumbnail_path,like_count,created_at,updated_at,publish_at,published_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    let query = supabase
      .from('articles')
      .select(select, { count: 'exact' })
      .order(orderKey, { ascending: !desc, nullsFirst: false })
      .range(start, end)
    const u = req.user
    const isOwnerView = author_id && (u?.id === author_id || u?.role === ROLES.ADMIN)
    if (!isOwnerView) {
      query = query.eq('status', 'published')
      const nowIso = new Date().toISOString()
      query = query.or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    }
    if (tag) query = query.contains('tags', [tag])
    if (category) query = query.contains('categories', [category])
    if (author_id) query = query.eq('author_id', author_id)
    if (q) query = query.ilike('title', `%${q}%`)
    if (fromDate) query = query.gte('created_at', fromDate.toISOString())
    const { data, error, count } = await query
    if (error) throw error
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    // Attach reading_time (words/200, min 1)
    const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
    const calcRead = (txt) => {
      const words = sanitize(txt).trim().split(/\s+/).filter(Boolean).length
      return Math.max(1, Math.round(words / 200))
    }
    const itemsWith = (data || []).map((a) => ({ ...a, reading_time: calcRead(a.content) }))
    res.json({
      items: itemsWith,
      pageInfo: { page, pageSize: limit, total, totalPages, sort: sortParam },
    })
  } catch (e) {
    console.error('List articles error:', e)
    res.status(500).json({ message: 'Failed to list articles', error: e?.message || String(e) })
  }
})

// Public Preview by token
router.get('/preview/:token', async (req, res) => {
  try {
    const token = req.params.token
    const select = `id,slug,title,content,author_id,status,tags,categories,thumbnail_url,thumbnail_path,like_count,created_at,updated_at,publish_at,published_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    const { data: article, error } = await supabase
      .from('articles')
      .select(select)
      .eq('preview_token', token)
      .maybeSingle()
    if (error) throw error
    if (!article) return res.status(404).json({ message: 'Preview not found' })
    // optionally enforce expiry
    // if (article.preview_token_expires_at && new Date(article.preview_token_expires_at) < new Date())
    //   return res.status(410).json({ message: 'Preview expired' })
    const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
    const words = sanitize(article.content).trim().split(/\s+/).filter(Boolean).length
    const reading_time = Math.max(1, Math.round(words / 200))
    res.json({ ...article, reading_time })
  } catch (e) {
    console.error('preview fetch error', e)
    res.status(500).json({ message: 'Failed to load preview' })
  }
})

// Generate or refresh a draft preview link
router.post('/:id/preview', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data: article, error: aErr } = await supabase.from('articles').select('id, author_id').eq('id', id).maybeSingle()
    if (aErr) throw aErr
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (req.user.role !== ROLES.ADMIN && article.author_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
    const token = randomUUID().replace(/-/g,'')
    const expiresAt = (() => {
      const d = new Date(); d.setDate(d.getDate() + 7); return d
    })()
    const { data, error } = await supabase
      .from('articles')
      .update({ preview_token: token, preview_token_expires_at: expiresAt, updated_at: new Date() })
      .eq('id', id)
      .select('id, slug, preview_token, preview_token_expires_at')
      .single()
    if (error) throw error
    const base = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '')
    const origin = base || ''
    const path = `/p/${data.preview_token}`
    res.json({ token: data.preview_token, expires_at: data.preview_token_expires_at, url: origin ? origin + path : path })
  } catch (e) {
    console.error('preview gen error', e)
    res.status(500).json({ message: 'Failed to create preview link' })
  }
})

// Get single article by id (published or owned by author/admin)
router.get('/:id', authOptional, async (req, res) => {
  try {
    const id = req.params.id
    const select = `id,slug,title,content,author_id,status,tags,categories,thumbnail_url,thumbnail_path,like_count,created_at,updated_at,publish_at,published_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    const { data: article, error } = await supabase.from('articles').select(select).eq('id', id).maybeSingle()
    if (error) throw error
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (article.status !== 'published') {
      const u = req.user
      if (!u || (u.id !== article.author_id && u.role !== ROLES.ADMIN)) return res.status(403).json({ message: 'Forbidden' })
    } else {
      const now = new Date()
      if (article.publish_at && new Date(article.publish_at) > now) {
        const u = req.user
        if (!u || (u.id !== article.author_id && u.role !== ROLES.ADMIN)) return res.status(403).json({ message: 'Forbidden' })
      }
    }
    // Best-effort: record a view and attach reading_time
    try { await supabase.from('article_views').insert({ id: randomUUID(), article_id: id, user_id: req.user?.id || null, created_at: new Date() }) } catch {}
    const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
    const words = sanitize(article.content).trim().split(/\s+/).filter(Boolean).length
    const reading_time = Math.max(1, Math.round(words / 200))
    res.json({ ...article, reading_time })
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
      // Authors cannot directly publish; only admins may set published
      status: (() => {
        const allowed = ['draft', 'pending', 'published']
        let s = typeof req.body.status === 'string' && allowed.includes(req.body.status) ? req.body.status : 'pending'
        if (req.user.role !== ROLES.ADMIN && s === 'published') s = 'pending'
        return s
      })(),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      categories: Array.isArray(req.body.categories) ? req.body.categories : [],
      thumbnail_url: typeof req.body.thumbnail_url === 'string' ? req.body.thumbnail_url : '',
      thumbnail_path: typeof req.body.thumbnail_path === 'string' ? req.body.thumbnail_path : '',
      like_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }
    // publish_at allowed for admins only
    if (req.user.role === ROLES.ADMIN && req.body.publish_at) {
      const p = new Date(req.body.publish_at)
      if (!isNaN(p.getTime())) payload.publish_at = p
    }
    // generate slug
    const requestedSlug = typeof req.body.slug === 'string' && req.body.slug.trim()
      ? slugify(req.body.slug)
      : slugify(payload.title)
    payload.slug = await ensureUniqueSlug(supabase, requestedSlug)
    validateArticle(payload)
    // if admin created published and not scheduled in future, mark published_at
    const now = new Date()
    if (payload.status === 'published') {
      const pAt = payload.publish_at ? new Date(payload.publish_at) : null
      if (!pAt || pAt <= now) payload.published_at = now
    }
    const { data, error } = await supabase.from('articles').insert(payload).select('*').single()
    if (error) throw error
    // create initial revision
    try {
      await supabase.from('article_revisions').insert({ id: randomUUID(), article_id: data.id, author_id, title: data.title, content: data.content })
    } catch (e) { console.error('rev create error', e) }
    // If pending, notify admins of submission
    try { if (data?.status === 'pending') await notifyAdminsOfPendingArticle(data.id) } catch (e) { console.error('notify admins create pending', e) }
    // If went live now, notify followers
    try {
      if (data?.status === 'published' && data?.published_at && (!data.publish_at || new Date(data.publish_at) <= now)) {
        await notifyFollowersOfArticle(author_id, data.id, data.title)
      }
    } catch (e) { console.error('notify followers create', e) }
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
      updated_at: new Date(),
    }
    if (req.user.role === ROLES.ADMIN && typeof req.body.publish_at !== 'undefined') {
      if (req.body.publish_at === null || req.body.publish_at === '') patch.publish_at = null
      else {
        const p = new Date(req.body.publish_at)
        if (!isNaN(p.getTime())) patch.publish_at = p
      }
    }
    // Validate/adjust status transitions
    if (typeof req.body.status === 'string') {
      const allowed = ['draft', 'pending', 'published']
      let s = allowed.includes(req.body.status) ? req.body.status : existing.status
      if (req.user.role !== ROLES.ADMIN && s === 'published') s = 'pending'
      patch.status = s
    } else {
      patch.status = existing.status
    }
    if (typeof req.body.slug === 'string' && req.body.slug.trim()) {
      const s = slugify(req.body.slug)
      patch.slug = await ensureUniqueSlug(supabase, s)
    }
    validateArticle({ ...existing, ...patch })

    // if thumbnail changed, attempt to delete old asset
    if (patch.thumbnail_path !== existing.thumbnail_path && existing.thumbnail_path) {
      try {
        await supabase.storage.from('thumbnails').remove([existing.thumbnail_path])
      } catch {}
    }

    // set published_at when becoming public now
    const now2 = new Date()
    if (patch.status === 'published' && req.user.role === ROLES.ADMIN) {
      const pAt = (typeof patch.publish_at !== 'undefined' ? patch.publish_at : existing.publish_at) || null
      if (!pAt || new Date(pAt) <= now2) patch.published_at = now2
    }
    const { data, error } = await supabase.from('articles').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    // add revision on update
    try {
      await supabase.from('article_revisions').insert({ id: randomUUID(), article_id: id, author_id: existing.author_id, title: data.title, content: data.content })
      // keep only latest 20
      const { data: revs } = await supabase.from('article_revisions').select('id, created_at').eq('article_id', id).order('created_at', { ascending: false })
      const toDelete = (revs || []).slice(20).map(r => r.id)
      if (toDelete.length) await supabase.from('article_revisions').delete().in('id', toDelete)
    } catch (e) { console.error('rev update error', e) }
    // If transitioning to published, notify followers
    try {
      if (existing.status !== 'published' && data?.status === 'published') {
        const pAt = data.publish_at ? new Date(data.publish_at) : null
        if (!pAt || pAt <= now2) await notifyFollowersOfArticle(existing.author_id, id, data.title)
      }
    } catch (e) { console.error('notify followers update', e) }
    // If transitioning into pending, notify admins
    try { if (existing.status !== 'pending' && data?.status === 'pending') await notifyAdminsOfPendingArticle(id) } catch (e) { console.error('notify admins pending update', e) }
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

// Admin: approve article (optional schedule via publish_at)
router.post('/:id/approve', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const patch = { status: 'published', updated_at: new Date() }
    if (typeof req.body?.publish_at !== 'undefined') {
      if (req.body.publish_at === null || req.body.publish_at === '') patch.publish_at = null
      else {
        const p = new Date(req.body.publish_at)
        if (!isNaN(p.getTime())) patch.publish_at = p
      }
    }
    const now = new Date()
    const pAt = patch.publish_at || null
    if (!pAt || new Date(pAt) <= now) patch.published_at = now
    const { data, error } = await supabase.from('articles').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    // notify author on approval
    try { if (data?.author_id) await notify(data.author_id, 'article_approved', { article_id: id, title: data.title }) } catch (e) { console.error('approve notify error', e) }
    // notify followers of new post
    try {
      if (data?.author_id && (!data.publish_at || new Date(data.publish_at) <= new Date())) {
        await notifyFollowersOfArticle(data.author_id, id, data.title)
      }
    } catch (e) { console.error('approve notify followers error', e) }
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to approve' })
  }
})

// Admin: reject article with reason (moves to draft)
router.post('/:id/reject', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : ''
    const { data: existing, error: findErr } = await supabase
      .from('articles')
      .select('id, author_id, title, status')
      .eq('id', id)
      .maybeSingle()
    if (findErr) throw findErr
    if (!existing) return res.status(404).json({ message: 'Not found' })
    const { data, error } = await supabase
      .from('articles')
      .update({ status: 'draft', updated_at: new Date() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    try { if (existing.author_id) await notify(existing.author_id, 'article_rejected', { article_id: id, title: existing.title, reason }) } catch (e) { console.error('reject notify error', e) }
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to reject' })
  }
})

export default router
// Get by slug
router.get('/slug/:slug', authOptional, async (req, res) => {
  try {
    const slug = req.params.slug
    const select = `id,slug,title,content,author_id,status,tags,categories,thumbnail_url,thumbnail_path,like_count,created_at,updated_at,publish_at,published_at,author:users!articles_author_id_fkey(id,name,avatar_url)`
    const { data: article, error } = await supabase.from('articles').select(select).eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (article.status !== 'published') {
      const u = req.user
      if (!u || (u.id !== article.author_id && u.role !== ROLES.ADMIN)) return res.status(403).json({ message: 'Forbidden' })
    } else {
      const now = new Date()
      if (article.publish_at && new Date(article.publish_at) > now) {
        const u = req.user
        if (!u || (u.id !== article.author_id && u.role !== ROLES.ADMIN)) return res.status(403).json({ message: 'Forbidden' })
      }
    }
    // Best-effort: record a view and attach reading_time
    try { await supabase.from('article_views').insert({ id: randomUUID(), article_id: article.id, user_id: req.user?.id || null, created_at: new Date() }) } catch {}
    const sanitize = (txt) => String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#!*_>`]/g, ' ')
    const words = sanitize(article.content).trim().split(/\s+/).filter(Boolean).length
    const reading_time = Math.max(1, Math.round(words / 200))
    res.json({ ...article, reading_time })
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch by slug' })
  }
})

// Revisions: list
router.get('/:id/revisions', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { data: article, error: aErr } = await supabase.from('articles').select('author_id').eq('id', id).maybeSingle()
    if (aErr) throw aErr
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (req.user.role !== ROLES.ADMIN && article.author_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
    const { data, error } = await supabase.from('article_revisions').select('id,title,created_at').eq('article_id', id).order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    res.status(500).json({ message: 'Failed to load revisions' })
  }
})

// Revisions: restore
router.post('/:id/revisions/:revId/restore', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const { id, revId } = req.params
    const { data: article, error: aErr } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
    if (aErr) throw aErr
    if (!article) return res.status(404).json({ message: 'Not found' })
    if (req.user.role !== ROLES.ADMIN && article.author_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
    const { data: rev, error: rErr } = await supabase.from('article_revisions').select('*').eq('id', revId).eq('article_id', id).maybeSingle()
    if (rErr) throw rErr
    if (!rev) return res.status(404).json({ message: 'Revision not found' })
    const patch = { title: rev.title, content: rev.content, updated_at: new Date() }
    const { data, error } = await supabase.from('articles').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    // snapshot after restore as well
    try { await supabase.from('article_revisions').insert({ id: randomUUID(), article_id: id, author_id: article.author_id, title: data.title, content: data.content }) } catch {}
    res.json(data)
  } catch (e) {
    res.status(500).json({ message: 'Failed to restore revision' })
  }
})

// Related/suggested articles
router.get('/:id/related', authOptional, async (req, res) => {
  try {
    const id = req.params.id
    // fetch base article to get categories/tags
    const { data: base, error: bErr } = await supabase
      .from('articles')
      .select('id,categories,tags,author_id,status')
      .eq('id', id)
      .maybeSingle()
    if (bErr) throw bErr
    if (!base) return res.status(404).json({ message: 'Not found' })
    const select = 'id,slug,title,thumbnail_url,like_count,created_at,categories,tags,publish_at,published_at,author:users!articles_author_id_fkey(id,name,avatar_url)'
    const related = new Map()
    // by categories
    const cats = Array.isArray(base.categories) ? base.categories : []
    for (const c of cats.slice(0, 3)) {
      const { data } = await supabase
        .from('articles')
        .select(select)
        .eq('status', 'published')
        .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
        .contains('categories', [c])
        .neq('id', id)
        .order('like_count', { ascending: false })
        .limit(6)
      for (const a of data || []) related.set(a.id, a)
      if (related.size >= 6) break
    }
    // by tags if still need
    const tags = Array.isArray(base.tags) ? base.tags : []
    if (related.size < 6) {
      for (const t of tags.slice(0, 5)) {
        const { data } = await supabase
          .from('articles')
          .select(select)
          .eq('status', 'published')
          .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
          .contains('tags', [t])
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(6)
        for (const a of data || []) related.set(a.id, a)
        if (related.size >= 6) break
      }
    }
    // score by overlap (categories weighted higher), then likes and recency
    const baseCats = new Set(cats)
    const baseTags = new Set(tags)
    const items = Array.from(related.values())
    const scored = items.map((a) => {
      const aCats = new Set(Array.isArray(a.categories) ? a.categories : [])
      const aTags = new Set(Array.isArray(a.tags) ? a.tags : [])
      let catOverlap = 0
      for (const c of aCats) if (baseCats.has(c)) catOverlap++
      let tagOverlap = 0
      for (const t of aTags) if (baseTags.has(t)) tagOverlap++
      const like = a.like_count || 0
      const ts = a.created_at ? new Date(a.created_at).getTime() : 0
      const score = catOverlap * 2 + tagOverlap + like * 0.001 + ts / 1e14
      return { score, a }
    })
    scored.sort((x, y) => y.score - x.score)
    const itemsSorted = scored.map(s => s.a).slice(0, 6)
    res.json(itemsSorted)
  } catch (e) {
    console.error('related error', e)
    res.status(500).json({ message: 'Failed to load related' })
  }
})
