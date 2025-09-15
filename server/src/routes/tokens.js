import express from 'express'
import crypto from 'crypto'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { supabase } from '../supabase.js'

const router = express.Router()

function toHash(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex')
}

// List my API tokens (metadata only)
router.get('/', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_tokens')
      .select('id, name, scopes, created_at, expires_at, last_used_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to list tokens' })
  }
})

// Create a new personal access token for the current author
router.post('/', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim().slice(0, 80) || 'API token'
    const scopes = Array.isArray(req.body?.scopes) && req.body.scopes.length ? req.body.scopes : ['articles:write', 'media:upload']
    const days = Math.min(730, Math.max(1, parseInt(req.body?.expires_in_days || '365', 10)))
    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const raw = 'pat_' + crypto.randomBytes(24).toString('base64url')
    const row = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      name,
      token_hash: toHash(raw),
      scopes,
      created_at: new Date(),
      expires_at,
    }
    const { error } = await supabase.from('api_tokens').insert(row)
    if (error) throw error
    // Important: only return the raw token once
    res.status(201).json({ id: row.id, name, scopes, expires_at, token: raw })
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to create token' })
  }
})

// Revoke/delete a token
router.delete('/:id', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const id = req.params.id
    const { error } = await supabase.from('api_tokens').delete().eq('id', id).eq('user_id', req.user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to revoke token' })
  }
})

export default router

