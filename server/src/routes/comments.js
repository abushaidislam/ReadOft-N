import express from 'express'
import { randomUUID } from 'node:crypto'
import { authRequired } from '../middleware/auth.js'
import { supabase } from '../supabase.js'
import { ROLES } from '../utils/roles.js'

const router = express.Router()

// Get all comments for an article (flat list with user info)
router.get('/articles/:articleId/comments', async (req, res) => {
  try {
    const articleId = req.params.articleId
    const select = 'id, article_id, user_id, content, parent_id, created_at, updated_at, user:users!comments_user_id_fkey(id, name, avatar_url)'
    const { data, error } = await supabase
      .from('comments')
      .select(select)
      .eq('article_id', articleId)
      .order('created_at', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (e) {
    console.error('Load comments error:', e)
    res.status(500).json({ message: 'Failed to load comments' })
  }
})

// Create a comment or reply
router.post('/articles/:articleId/comments', authRequired, async (req, res) => {
  try {
    const article_id = req.params.articleId
    const user_id = req.user.id
    const content = (req.body?.content || '').toString().trim()
    const parent_id = req.body?.parent_id || null
    if (!content) return res.status(400).json({ message: 'Content is required' })
    if (content.length > 2000) return res.status(400).json({ message: 'Comment too long (max 2000 chars)' })

    // If replying, ensure parent exists and belongs to the same article
    if (parent_id) {
      const { data: parent, error: pErr } = await supabase
        .from('comments')
        .select('id, article_id')
        .eq('id', parent_id)
        .maybeSingle()
      if (pErr) throw pErr
      if (!parent) return res.status(404).json({ message: 'Parent comment not found' })
      if (parent.article_id !== article_id) return res.status(400).json({ message: 'Parent does not belong to this article' })
    }

    const row = {
      id: randomUUID(),
      article_id,
      user_id,
      content,
      parent_id,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const { data, error } = await supabase
      .from('comments')
      .insert(row)
      .select('id, article_id, user_id, content, parent_id, created_at, updated_at')
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (e) {
    console.error('Create comment error:', e)
    res.status(500).json({ message: e?.message || 'Failed to create comment' })
  }
})

// Delete a comment (author or admin only). Replies are deleted via cascade.
router.delete('/comments/:id', authRequired, async (req, res) => {
  try {
    const id = req.params.id
    const { data: existing, error: fErr } = await supabase
      .from('comments')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()
    if (fErr) throw fErr
    if (!existing) return res.status(404).json({ message: 'Not found' })
    if (existing.user_id !== req.user.id && req.user.role !== ROLES.ADMIN)
      return res.status(403).json({ message: 'Forbidden' })

    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('Delete comment error:', e)
    res.status(500).json({ message: 'Failed to delete comment' })
  }
})

export default router

