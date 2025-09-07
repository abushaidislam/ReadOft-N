import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

// Check bookmark status for current user and an article
router.get('/bookmarks/status/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('article_id', article_id)
      .maybeSingle()
    if (error) throw error
    res.json({ saved: Boolean(data) })
  } catch (e) {
    console.error('Bookmark status error:', e)
    res.status(500).json({ message: 'Failed to check bookmark status' })
  }
})

// Save a bookmark
router.post('/bookmarks/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { error } = await supabase
      .from('user_bookmarks')
      .insert({ user_id, article_id })
    if (error) {
      if (error.code === '23505') { // unique violation
        return res.json({ success: false, saved: true, message: 'Already saved' })
      }
      throw error
    }
    res.json({ success: true, saved: true })
  } catch (e) {
    console.error('Bookmark add error:', e)
    res.status(500).json({ message: 'Failed to save bookmark' })
  }
})

// Remove a bookmark
router.delete('/bookmarks/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { data, error } = await supabase
      .from('user_bookmarks')
      .delete()
      .eq('user_id', user_id)
      .eq('article_id', article_id)
      .select('user_id')
    if (error) throw error
    const removed = Array.isArray(data) && data.length > 0
    res.json({ success: removed, saved: false })
  } catch (e) {
    console.error('Bookmark remove error:', e)
    res.status(500).json({ message: 'Failed to remove bookmark' })
  }
})

// List saved articles of current user
router.get('/bookmarks/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select('article_id, articles:article_id (id, title, author_id, like_count, thumbnail_url, created_at)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data?.map((r) => r.articles) ?? [])
  } catch (e) {
    console.error('Bookmark list error:', e)
    res.status(500).json({ message: 'Failed to list bookmarks' })
  }
})

export default router

