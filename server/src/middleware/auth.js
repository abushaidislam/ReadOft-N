import jwt from 'jsonwebtoken'
import { supabase } from '../supabase.js'
async function refreshRole(req) {
  try {
    if (!req.user?.id) return
    const { data, error } = await supabase.from('users').select('role').eq('id', req.user.id).single()
    if (!error && data?.role) req.user.role = data.role
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
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    await refreshRole(req)
    next()
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

function getToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length)
  return null
}
