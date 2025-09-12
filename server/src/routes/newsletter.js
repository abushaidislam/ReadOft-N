import express from 'express'
import { supabase } from '../supabase.js'
import { randomUUID } from 'node:crypto'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'

const router = express.Router()

// Public: subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email' })
    }
    // insert if not exists
    const { data: existing } = await supabase
      .from('newsletter_subscriptions')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existing) return res.json({ success: true, subscribed: true })
    const row = { id: randomUUID(), email, created_at: new Date() }
    const { error } = await supabase.from('newsletter_subscriptions').insert(row)
    if (error) throw error
    res.json({ success: true, subscribed: true })
  } catch (e) {
    console.error('newsletter subscribe error', e)
    res.status(500).json({ message: 'Failed to subscribe' })
  }
})

// Admin: list/export subscriptions
router.get('/list', authRequired, requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('newsletter list error', e)
    res.status(500).json({ message: 'Failed to load subscriptions' })
  }
})

export default router
