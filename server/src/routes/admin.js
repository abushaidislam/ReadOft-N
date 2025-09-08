import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

const router = express.Router()

// List users (basic info)
router.get('/users', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, email, name, role, is_banned, created_at').order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list users' })
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

export default router
