import express from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { supabase } from '../supabase.js'
import { ROLES } from '../utils/roles.js'
import { validateUser } from '../models/user.js'

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

export default router
