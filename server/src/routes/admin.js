import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'

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

export default router
