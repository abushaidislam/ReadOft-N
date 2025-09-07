import express from 'express'
import { supabase } from '../supabase.js'

const router = express.Router()

// Basic author profile
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, bio, avatar_url, role, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!user) return res.status(404).json({ message: 'Author not found' })
    res.json(user)
  } catch (e) {
    console.error('author profile error', e)
    res.status(500).json({ message: 'Failed to load author' })
  }
})

// Author summary: counts for posts (published), likes sum, followers count
router.get('/:id/summary', async (req, res) => {
  try {
    const authorId = req.params.id
    // Author info
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, name, bio, avatar_url, role, created_at')
      .eq('id', authorId)
      .maybeSingle()
    if (uErr) throw uErr
    if (!user) return res.status(404).json({ message: 'Author not found' })

    // Posts count (published)
    const { count: posts, error: cErr } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', authorId)
      .eq('status', 'published')
    if (cErr) throw cErr

    // Likes sum (published)
    const { data: likesRows, error: lErr } = await supabase
      .from('articles')
      .select('like_count')
      .eq('author_id', authorId)
      .eq('status', 'published')
    if (lErr) throw lErr
    const likes = (likesRows || []).reduce((acc, r) => acc + (r.like_count || 0), 0)

    // Followers count
    const { count: followers, error: fErr } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', authorId)
    if (fErr) throw fErr

    res.json({ user, counts: { posts: posts || 0, likes, followers: followers || 0 } })
  } catch (e) {
    console.error('author summary error', e)
    res.status(500).json({ message: 'Failed to load author summary' })
  }
})

export default router

