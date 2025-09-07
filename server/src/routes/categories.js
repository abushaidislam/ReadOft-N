import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { slugify } from '../utils/slug.js'
import { validateCategory } from '../models/category.js'
import { randomUUID } from 'node:crypto'

const router = express.Router()

// Public: list categories
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (e) {
    console.error('List categories error:', e)
    res.status(500).json({ message: 'Failed to list categories' })
  }
})

// Admin: create
router.post('/', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const name = String(req.body.name || '')
    const slug = (req.body.slug && String(req.body.slug)) || slugify(name)
    const payload = { id: randomUUID(), name, slug, created_at: new Date() }
    validateCategory(payload)
    const { data, error } = await supabase.from('categories').insert(payload).select('*').single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Slug already exists' })
      throw error
    }
    res.status(201).json(data)
  } catch (e) {
    console.error('Create category error:', e)
    res.status(500).json({ message: e.message || 'Failed to create category' })
  }
})

// Admin: update
router.put('/:id', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const patch = {}
    if (req.body.name) patch.name = String(req.body.name)
    if (req.body.slug) patch.slug = String(req.body.slug)
    if (patch.slug) patch.slug = slugify(patch.slug)
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update' })
    const { data, error } = await supabase.from('categories').update(patch).eq('id', req.params.id).select('*').single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Slug already exists' })
      throw error
    }
    res.json(data)
  } catch (e) {
    console.error('Update category error:', e)
    res.status(500).json({ message: 'Failed to update category' })
  }
})

// Admin: delete
router.delete('/:id', authRequired, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('Delete category error:', e)
    res.status(500).json({ message: 'Failed to delete category' })
  }
})

export default router

