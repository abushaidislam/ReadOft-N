import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authRequired } from '../middleware/auth.js'
import { supabase } from '../supabase.js'
import { validateUser } from '../models/user.js'

const router = express.Router()

// Get my profile
router.get('/', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, bio, avatar_url, avatar_path, created_at')
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

