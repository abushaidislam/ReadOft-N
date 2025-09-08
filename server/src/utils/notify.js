import { randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'
import { pushOne, pushMany } from './notifyHub.js'

export async function notify(user_id, type, payload = {}) {
  try {
    if (!user_id) return
    const row = { id: randomUUID(), user_id, type, payload, is_read: false, created_at: new Date() }
    const { error } = await supabase.from('notifications').insert(row)
    if (error) console.error('notify insert error', error)
    // push SSE if connected
    pushOne(user_id, row)
  } catch (e) {
    console.error('notify error', e)
  }
}

export async function notifyFollowersOfArticle(author_id, article_id, title) {
  try {
    if (!author_id || !article_id) return
    const { data: rows, error } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('author_id', author_id)
    if (error) { console.error('followers fetch error', error); return }
    const followers = (rows || []).map(r => r.follower_id).filter(Boolean)
    if (followers.length === 0) return
    // Fetch author+article details for richer payload
    const [{ data: art, error: artErr }, { data: author, error: aErr }] = await Promise.all([
      supabase.from('articles').select('title, thumbnail_url').eq('id', article_id).single(),
      supabase.from('users').select('name, avatar_url').eq('id', author_id).single(),
    ])
    if (artErr) console.error('fetch article for notify error', artErr)
    if (aErr) console.error('fetch author for notify error', aErr)
    const now = new Date()
    const payloadBase = {
      article_id,
      title: art?.title || title,
      author_id,
      author_name: author?.name || undefined,
      author_avatar_url: author?.avatar_url || undefined,
      thumbnail_url: art?.thumbnail_url || undefined,
    }
    const rowsToInsert = followers.map(uid => ({
      id: randomUUID(), user_id: uid, type: 'new_post_by_followed_author',
      payload: payloadBase, is_read: false, created_at: now,
    }))
    const { data: inserted, error: insErr } = await supabase
      .from('notifications')
      .insert(rowsToInsert)
      .select('id, user_id, type, payload, is_read, created_at')
    if (insErr) console.error('notify followers insert error', insErr)
    if (Array.isArray(inserted)) {
      for (const row of inserted) pushOne(row.user_id, row)
    }
  } catch (e) {
    console.error('notifyFollowersOfArticle error', e)
  }
}

export async function notifyAdmins(type, payload = {}) {
  try {
    const { data: admins, error } = await supabase.from('users').select('id').eq('role', 'admin')
    if (error) { console.error('notifyAdmins fetch error', error); return }
    const ids = (admins || []).map((u) => u.id).filter(Boolean)
    if (ids.length === 0) return
    const now = new Date()
    const rows = ids.map((uid) => ({ id: randomUUID(), user_id: uid, type, payload, is_read: false, created_at: now }))
    const { data: inserted, error: insErr } = await supabase
      .from('notifications')
      .insert(rows)
      .select('id, user_id, type, payload, is_read, created_at')
    if (insErr) { console.error('notifyAdmins insert error', insErr); return }
    if (Array.isArray(inserted)) {
      for (const row of inserted) pushOne(row.user_id, row)
    }
  } catch (e) {
    console.error('notifyAdmins error', e)
  }
}

export async function notifyAdminsOfPendingArticle(article_id) {
  try {
    const { data: art, error } = await supabase
      .from('articles')
      .select('id,title,author_id,thumbnail_url')
      .eq('id', article_id)
      .single()
    if (error) throw error
    const { data: author } = await supabase
      .from('users')
      .select('name,avatar_url')
      .eq('id', art.author_id)
      .single()
    await notifyAdmins('pending_article_submitted', {
      article_id: art.id,
      title: art.title,
      author_id: art.author_id,
      author_name: author?.name || undefined,
      author_avatar_url: author?.avatar_url || undefined,
      thumbnail_url: art?.thumbnail_url || undefined,
    })
  } catch (e) {
    console.error('notifyAdminsOfPendingArticle error', e)
  }
}
