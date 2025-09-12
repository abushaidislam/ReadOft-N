import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { authRequired } from '../middleware/auth.js'
import { supabase } from '../supabase.js'
import { validateUser } from '../models/user.js'

const router = express.Router()

// Get my profile
router.get('/', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, bio, avatar_url, avatar_path, is_banned, created_at')
      .eq('id', req.user.id)
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ message: 'Failed to load profile' })
  }
})

// Update name/bio/avatar
router.put('/', authRequired, async (req, res) => {
  try {
    const patch = {}
    if (typeof req.body.name === 'string') patch.name = req.body.name
    if (typeof req.body.bio === 'string') patch.bio = req.body.bio
    if (typeof req.body.avatar_url === 'string') patch.avatar_url = req.body.avatar_url
    if (typeof req.body.avatar_path === 'string') patch.avatar_path = req.body.avatar_path
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update' })

    // validate basic shape via mongoose schema in memory
    validateUser({ id: req.user.id, email: req.user.email, password_hash: 'x', name: patch.name || req.user.name, role: req.user.role, bio: patch.bio || '', avatar_url: patch.avatar_url || '', avatar_path: patch.avatar_path || '', created_at: new Date() })

    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.user.id)
      .select('id, email, name, role, bio, avatar_url, avatar_path, created_at')
      .single()
    if (error) throw error
    res.json(data)
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to update profile' })
  }
})

// Change password
router.put('/password', authRequired, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {}
    if (!current_password || !new_password) return res.status(400).json({ message: 'Missing fields' })
    const { data: user, error } = await supabase.from('users').select('id, email, name, role, password_hash').eq('id', req.user.id).single()
    if (error) throw error
    const ok = await bcrypt.compare(current_password, user.password_hash)
    if (!ok) return res.status(401).json({ message: 'Current password incorrect' })
    const password_hash = await bcrypt.hash(new_password, 10)
    const { error: upErr } = await supabase.from('users').update({ password_hash }).eq('id', req.user.id)
    if (upErr) throw upErr
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    res.json({ success: true, token })
  } catch (e) {
    res.status(500).json({ message: 'Failed to change password' })
  }
})

export default router
// Apply to become author (not a route end; we add below)

// Reader applies to become author: send admin notification
router.post('/apply-author', authRequired, async (req, res) => {
  try {
    // prevent duplicate within 24h
    const since = new Date(Date.now() - 24*60*60*1000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'author_role_request')
      .eq('payload->>user_id', req.user.id)
      .gte('created_at', since)
    if (existing && existing.length > 0) return res.json({ ok: true, queued: true })

    const payload = { user_id: req.user.id, name: req.user.name || '', email: req.user.email || '' }
    // notify admins
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
    const rows = (admins||[]).map(a => ({ user_id: a.id, type: 'author_role_request', payload, is_read:false, created_at:new Date() }))
    for (const r of rows) r.id = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2)+Date.now())
    await supabase.from('notifications').insert(rows)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: 'Failed to submit application' })
  }
})

router.get('/apply-author/status', authRequired, async (req, res) => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('id, created_at, is_read')
      .eq('type', 'author_role_request')
      .eq('payload->>user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const last = (data||[])[0]
    res.json({ requestedAt: last?.created_at || null })
  } catch {
    res.json({ requestedAt: null })
  }
})
