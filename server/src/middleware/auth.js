import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { supabase } from '../supabase.js'
async function refreshRole(req) {
  try {
    if (!req.user?.id) return
    const { data, error } = await supabase.from('users').select('role,is_banned').eq('id', req.user.id).single()
    if (!error && data) { req.user.role = data.role; req.user.is_banned = !!data.is_banned }
  } catch {}
}

export async function authOptional(req, _res, next) {
  const token = getToken(req)
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
      await refreshRole(req)
    } catch {
      // ignore invalid tokens when optional
    }
  }
  next()
}

export async function authRequired(req, res, next) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ message: 'Missing token' })
  try {
    // Try JWT first
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
      await refreshRole(req)
      if (req.user?.is_banned) return res.status(403).json({ message: 'Banned account' })
      return next()
    } catch {
      // Fallback: Personal Access Token (hash lookup)
      const hash = crypto.createHash('sha256').update(String(token)).digest('hex')
      const nowIso = new Date().toISOString()
      const { data: row, error } = await supabase
        .from('api_tokens')
        .select('user_id, scopes, expires_at')
        .eq('token_hash', hash)
        .maybeSingle()
      if (error) throw error
      if (!row) throw new Error('Invalid token')
      if (row.expires_at && row.expires_at < nowIso) throw new Error('Expired token')
      // Load user
      const { data: user, error: uErr } = await supabase
        .from('users')
        .select('id,email,name,role,is_banned')
        .eq('id', row.user_id)
        .maybeSingle()
      if (uErr) throw uErr
      if (!user) throw new Error('User not found')
      if (user.is_banned) return res.status(403).json({ message: 'Banned account' })
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role, is_pat: true, scopes: row.scopes || [] }
      try { await supabase.from('api_tokens').update({ last_used_at: new Date() }).eq('token_hash', hash) } catch {}
      return next()
    }
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

function getToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length)
  const alt = req.headers['x-auth-token']
  if (alt && typeof alt === 'string') return alt
  return null
}
