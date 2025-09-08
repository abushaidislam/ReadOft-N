import express from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { supabase } from '../supabase.js'
import { ROLES } from '../utils/roles.js'
import { validateUser } from '../models/user.js'
import { randomBytes } from 'node:crypto'
import { sendMail } from '../utils/mailer.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) return res.status(400).json({ message: 'Missing fields' })

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (findErr) throw findErr
    if (existing) return res.status(409).json({ message: 'Email already registered' })

    const password_hash = await bcrypt.hash(password, 10)

    const toValidate = {
      id: randomUUID(),
      email: email.toLowerCase(),
      password_hash,
      name,
      role: ROLES.READER,
      bio: '',
      avatar_url: '',
      created_at: new Date(),
    }
    validateUser(toValidate)

    const { data, error } = await supabase.from('users').insert(toValidate).select('*').single()
    if (error) throw error

    const token = jwt.sign(
      { id: data.id, email: data.email, name: data.name, role: data.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    )
    res.status(201).json({ token, user: { id: data.id, email: data.email, name: data.name, role: data.role } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' })
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (error) throw error
    if (!user) return res.status(401).json({ message: 'Invalid email or password' })
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' })
    if (user.is_banned) return res.status(403).json({ message: 'Account banned' })
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    )
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Login failed' })
  }
})

// Request password reset link
router.post('/reset-request', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    if (!email) return res.status(400).json({ message: 'Email required' })

    // Find user by email
    const { data: user, error: fErr } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .maybeSingle()
    if (fErr) throw fErr

    // Always respond success to avoid user enumeration
    if (!user) return res.json({ success: true })

    // Create token valid for 1 hour
    const token = randomBytes(24).toString('hex')
    const id = randomUUID()
    const expires_at = new Date(Date.now() + 60 * 60 * 1000)
    const row = { id, user_id: user.id, token, expires_at, created_at: new Date() }
    const { error: insErr } = await supabase.from('password_resets').insert(row)
    if (insErr) throw insErr

    // Build reset link (prefer PUBLIC_BASE_URL for client)
    const base = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '')
    const origin = base || req.get('origin') || `${req.protocol}://${req.get('host')}`
    const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`

    // Send email (mailer handles dev fallback)
    try {
      await sendMail(
        user.email,
        'Reset your Readoft password',
        `Hello${user.name ? ' ' + user.name : ''},\n\nUse this link to reset your password: ${link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
        `<p>Hello${user.name ? ' ' + user.name : ''},</p><p>Use this link to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
      )
    } catch (e) {
      console.error('sendMail error', e)
    }

    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Failed to send reset email' })
  }
})

// Confirm password reset
router.post('/reset-confirm', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const password = String(req.body?.password || '')
    if (!token || !password) return res.status(400).json({ message: 'Token and password required' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })

    const nowIso = new Date().toISOString()
    const { data: pr, error: fErr } = await supabase
      .from('password_resets')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()
    if (fErr) throw fErr
    if (!pr) return res.status(400).json({ message: 'Invalid or expired token' })
    if (pr.used_at) return res.status(400).json({ message: 'Token already used' })
    if (pr.expires_at && new Date(pr.expires_at).toISOString() < nowIso) return res.status(400).json({ message: 'Token expired' })

    const password_hash = await bcrypt.hash(password, 10)
    const { error: uErr } = await supabase.from('users').update({ password_hash }).eq('id', pr.user_id)
    if (uErr) throw uErr
    // mark used and invalidate older tokens for same user
    try {
      await supabase.from('password_resets').update({ used_at: new Date() }).eq('id', pr.id)
      await supabase.from('password_resets').delete().eq('user_id', pr.user_id).lt('expires_at', new Date())
    } catch (e) { console.error('cleanup tokens error', e) }
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: e.message || 'Failed to reset password' })
  }
})

export default router
