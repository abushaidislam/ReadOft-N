import express from 'express'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { ROLES } from '../utils/roles.js'

const router = express.Router()

// Follow an author
router.post('/:authorId', authRequired, async (req, res) => {
  try {
    const follower_id = req.user.id
    const author_id = req.params.authorId
    if (follower_id === author_id) return res.status(400).json({ message: 'Cannot follow yourself' })

    // Ensure target is an author
    const { data: author, error: authorErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', author_id)
      .maybeSingle()
    if (authorErr) throw authorErr
    if (!author || (author.role !== ROLES.AUTHOR && author.role !== ROLES.ADMIN))
      return res.status(404).json({ message: 'Author not found' })

    const { error } = await supabase.from('user_follows').insert({ follower_id, author_id })
    if (error && error.code !== '23505') throw error // ignore duplicate
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to follow' })
  }
})

router.delete('/:authorId', authRequired, async (req, res) => {
  try {
    const follower_id = req.user.id
    const author_id = req.params.authorId
    const { error } = await supabase.from('user_follows').delete().eq('follower_id', follower_id).eq('author_id', author_id)
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to unfollow' })
  }
})

// List followed authors for current user
router.get('/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('author_id, authors:author_id (id, name, avatar_url)')
      .eq('follower_id', req.user.id)
    if (error) throw error
    res.json(data?.map((r) => r.authors) ?? [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list follows' })
  }
})

export default router

// Additional route: list followers for the current author
router.get('/followers/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id, followers:follower_id (id, name, avatar_url)')
      .eq('author_id', req.user.id)
    if (error) throw error
    res.json(data?.map((r) => r.followers) ?? [])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to list followers' })
  }
})
