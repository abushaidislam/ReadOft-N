import express from 'express'
import { supabase } from '../supabase.js'
import { randomUUID } from 'node:crypto'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'

const router = express.Router()

// Public: submit a contact message
router.post('/', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120)
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 160)
    const message = String(req.body?.message || '').trim().slice(0, 5000)
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
      return res.status(400).json({ message: 'Invalid input' })
    }
    const row = { id: randomUUID(), name, email, message, created_at: new Date() }
    const { error } = await supabase.from('contact_messages').insert(row)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('contact post error', e)
    res.status(500).json({ message: 'Failed to send message' })
  }
})

// Admin: list recent messages
router.get('/list', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, name, email, message, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('contact list error', e)
    res.status(500).json({ message: 'Failed to load messages' })
  }
})

export default router
