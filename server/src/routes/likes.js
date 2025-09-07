import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

// Check like status for current user and an article
router.get('/status/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { data, error } = await supabase
      .from('article_likes')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('article_id', article_id)
      .maybeSingle()
    if (error) throw error
    res.json({ liked: Boolean(data) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to check like status' })
  }
})

// Like once per user/article
router.post('/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { data, error } = await supabase
      .from('article_likes')
      .insert({ user_id, article_id })
      .select('user_id')
      .single()
    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ success: false, liked: true, message: 'Already liked' })
      }
      throw error
    }
    await supabase.rpc('increment_like_count', { p_article_id: article_id })
    res.json({ success: true, liked: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to like' })
  }
})

// Unlike only if a like existed
router.delete('/:articleId', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id
    const article_id = req.params.articleId
    const { data, error } = await supabase
      .from('article_likes')
      .delete()
      .eq('user_id', user_id)
      .eq('article_id', article_id)
      .select('user_id')
    if (error) throw error
    const removed = Array.isArray(data) && data.length > 0
    if (removed) await supabase.rpc('decrement_like_count', { p_article_id: article_id })
    res.json({ success: removed, liked: false })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to unlike' })
  }
})

// list liked articles by current user
router.get('/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('article_likes')
      .select('article_id, articles:article_id (id, title, author_id, like_count)')
      .eq('user_id', req.user.id)
    if (error) throw error
    res.json(data?.map((r) => r.articles) ?? [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list likes' })
  }
})

export default router
