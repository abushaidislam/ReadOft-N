import express from 'express'
import { authRequired } from '../middleware/auth.js'
import { supabase } from '../supabase.js'

const router = express.Router()

// Track reading time (seconds) for an article
router.post('/', authRequired, async (req, res) => {
  try {
    const { article_id, duration_seconds } = req.body || {}
    const delta = Math.max(0, parseInt(duration_seconds) || 0)
    if (!article_id || delta <= 0) return res.status(400).json({ message: 'Invalid payload' })

    // check existing
    const { data: existing, error: selErr } = await supabase
      .from('article_reads')
      .select('duration_seconds')
      .eq('user_id', req.user.id)
      .eq('article_id', article_id)
      .maybeSingle()
    if (selErr) throw selErr
    if (existing) {
      const { error: upErr } = await supabase
        .from('article_reads')
        .update({ duration_seconds: existing.duration_seconds + delta, last_read_at: new Date() })
        .eq('user_id', req.user.id)
        .eq('article_id', article_id)
      if (upErr) throw upErr
    } else {
      const { error: insErr } = await supabase
        .from('article_reads')
        .insert({ user_id: req.user.id, article_id, duration_seconds: delta, last_read_at: new Date() })
      if (insErr) throw insErr
    }
    res.json({ success: true })
  } catch (e) {
    console.error('reads track error', e)
    res.status(500).json({ message: 'Failed to track read' })
  }
})

// List my reading history (latest first)
router.get('/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('article_reads')
      .select('duration_seconds, last_read_at, articles:article_id (id, title, slug, thumbnail_url, categories)')
      .eq('user_id', req.user.id)
      .order('last_read_at', { ascending: false })
    if (error) throw error
    res.json((data || []).map(r => ({
      article: r.articles,
      duration_seconds: r.duration_seconds,
      last_read_at: r.last_read_at,
    })))
  } catch (e) {
    console.error('reads list error', e)
    res.status(500).json({ message: 'Failed to list reads' })
  }
})

export default router


