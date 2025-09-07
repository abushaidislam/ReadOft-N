import express from 'express'
import { authRequired } from '../middleware/auth.js'
import { supabase } from '../supabase.js'

const router = express.Router()

// List notifications for current user
router.get('/notifications', authRequired, async (req, res) => {
  try {
    const unread = String(req.query.unread || '').trim() === '1'
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const offset = Math.max(0, parseInt(req.query.offset) || 0)
    let query = supabase
      .from('notifications')
      .select('id, type, payload, is_read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (unread) query = query.eq('is_read', false)
    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('notifications list error', e)
    res.status(500).json({ message: 'Failed to list notifications' })
  }
})

// Mark single notification as read
router.post('/notifications/:id/read', authRequired, async (req, res) => {
  try {
    const id = req.params.id
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('notifications read error', e)
    res.status(500).json({ message: 'Failed to mark read' })
  }
})

// Mark all as read
router.post('/notifications/read-all', authRequired, async (_req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', _req.user.id)
      .eq('is_read', false)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('notifications read-all error', e)
    res.status(500).json({ message: 'Failed to mark all read' })
  }
})

export default router

