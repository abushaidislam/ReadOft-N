import express from 'express'
import { randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'

const router = express.Router()

// Submit a report (auth required)
router.post('/reports', authRequired, async (req, res) => {
  try {
    const reporter_id = req.user.id
    const target_type = String(req.body?.target_type || '').toLowerCase()
    const target_id = String(req.body?.target_id || '')
    const reason = (req.body?.reason || '').toString().trim().slice(0, 1000)
    const allowed = ['post', 'comment', 'user']
    if (!allowed.includes(target_type)) return res.status(400).json({ message: 'Invalid target type' })
    if (!target_id) return res.status(400).json({ message: 'Target id is required' })
    if (!reason) return res.status(400).json({ message: 'Reason is required' })

    // Optional existence check
    try {
      if (target_type === 'post') {
        const { data } = await supabase.from('articles').select('id').eq('id', target_id).maybeSingle()
        if (!data) return res.status(404).json({ message: 'Article not found' })
      } else if (target_type === 'comment') {
        const { data } = await supabase.from('comments').select('id').eq('id', target_id).maybeSingle()
        if (!data) return res.status(404).json({ message: 'Comment not found' })
      } else if (target_type === 'user') {
        const { data } = await supabase.from('users').select('id').eq('id', target_id).maybeSingle()
        if (!data) return res.status(404).json({ message: 'User not found' })
      }
    } catch {}

    const row = { id: randomUUID(), reporter_id, target_type, target_id, reason, status: 'open', created_at: new Date() }
    const { data, error } = await supabase.from('reports').insert(row).select('*').single()
    if (error) throw error
    res.status(201).json(data)
  } catch (e) {
    console.error('report submit error', e)
    res.status(500).json({ message: 'Failed to submit report' })
  }
})

// Admin: list reports with basic filters
router.get('/admin/reports', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const status = String(req.query.status || '').toLowerCase()
    const type = String(req.query.type || '').toLowerCase()
    let q = supabase
      .from('reports')
      .select('id, reporter_id, target_type, target_id, reason, status, notes, created_at, reviewed_by, reviewed_at, reporter:users!reports_reporter_id_fkey(id, name, email)')
      .order('created_at', { ascending: false })
    if (['open', 'reviewed', 'dismissed', 'actioned'].includes(status)) q = q.eq('status', status)
    if (['post', 'comment', 'user'].includes(type)) q = q.eq('target_type', type)
    const { data, error } = await q
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('reports list error', e)
    res.status(500).json({ message: 'Failed to load reports' })
  }
})

// Admin: update report status/notes
router.put('/admin/reports/:id', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const patch = {}
    if (typeof req.body?.notes === 'string') patch.notes = req.body.notes.slice(0, 2000)
    if (typeof req.body?.status === 'string') {
      const s = req.body.status.toLowerCase()
      const allowed = ['open', 'reviewed', 'dismissed', 'actioned']
      if (!allowed.includes(s)) return res.status(400).json({ message: 'Invalid status' })
      patch.status = s
      patch.reviewed_by = req.user.id
      patch.reviewed_at = new Date()
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: 'Nothing to update' })
    const { data, error } = await supabase.from('reports').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error('report update error', e)
    res.status(500).json({ message: 'Failed to update report' })
  }
})

export default router

