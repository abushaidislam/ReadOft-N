import express from 'express'
import { randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'

const router = express.Router()

// Public VAPID key for client subscription
router.get('/public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || ''
  if (!key) return res.status(503).json({ message: 'VAPID public key not configured' })
  res.json({ publicKey: key })
})

// Save/refresh a subscription
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body?.subscription || req.body
    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription' })
    }
    const endpoint = String(sub.endpoint)
    const p256dh = String(sub.keys.p256dh)
    const auth = String(sub.keys.auth)
    // user is optional (authOptional applied globally)
    const user_id = req.user?.id || null

    // upsert by endpoint
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ user_id, p256dh, auth })
        .eq('endpoint', endpoint)
      if (error) throw error
    } else {
      const row = { id: randomUUID(), endpoint, user_id, p256dh, auth, created_at: new Date() }
      const { error } = await supabase.from('push_subscriptions').insert(row)
      if (error) throw error
    }

    res.json({ success: true })
  } catch (e) {
    console.error('push subscribe error', e)
    res.status(500).json({ message: 'Failed to save subscription' })
  }
})

// Remove a subscription
router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = String(req.body?.endpoint || '')
    if (!endpoint) return res.status(400).json({ message: 'Missing endpoint' })
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('push unsubscribe error', e)
    res.status(500).json({ message: 'Failed to unsubscribe' })
  }
})

// Admin: broadcast a simple message (requires web-push and VAPID env)
router.post('/broadcast', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    let webPush
    try { webPush = (await import('web-push')).default } catch (e) {
      return res.status(501).json({ message: 'web-push not installed on server' })
    }
    const { title = 'Readoft', body = 'New update', url = '/', user_id = null } = req.body || {}
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@example.com'
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(503).json({ message: 'VAPID keys missing' })
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth').order('created_at', { ascending: false })
    if (user_id) query = query.eq('user_id', user_id)
    const { data: subs, error } = await query
    if (error) throw error

    const payload = JSON.stringify({ title, body, url })
    const results = []
    for (const s of subs || []) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try {
        await webPush.sendNotification(subscription, payload)
        results.push({ endpoint: s.endpoint, ok: true })
      } catch (err) {
        results.push({ endpoint: s.endpoint, ok: false, error: err?.message })
      }
    }
    res.json({ success: true, sent: results.filter(r=>r.ok).length, total: results.length })
  } catch (e) {
    console.error('push broadcast error', e)
    res.status(500).json({ message: 'Failed to broadcast' })
  }
})

export default router
