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
    // best-effort Web Push
    try {
      const msg = buildPushMessage(type, payload)
      if (msg) await sendPushToUser(user_id, msg)
    } catch (e) { /* silent */ }
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
      // best-effort Web Push broadcast
      try {
        const msg = buildPushMessage('new_post_by_followed_author', payloadBase)
        await sendPushToUsers(followers, msg)
      } catch (e) { /* silent */ }
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
      // best-effort Web Push to all admins
      try {
        const msg = buildPushMessage(type, payload)
        if (msg) await sendPushToUsers(ids, msg)
      } catch (e) { /* silent */ }
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

// --- Web Push helpers ---
function buildPushMessage(type, payload) {
  try {
    if (type === 'new_post_by_followed_author') {
      const t = payload?.title || 'New post'
      const by = payload?.author_name ? ` by ${payload.author_name}` : ''
      return { title: `New post${by}`, body: t, url: `/article/${payload?.article_id}` }
    }
    if (type === 'comment_on_article') {
      return { title: 'New comment', body: `${payload?.title ? payload.title + ': ' : ''}${(payload?.excerpt||'').slice(0,80)}`, url: `/article/${payload?.article_id}` }
    }
    if (type === 'reply_to_comment') {
      return { title: 'New reply to your comment', body: (payload?.excerpt||'').slice(0,80), url: `/article/${payload?.article_id}` }
    }
    if (type === 'article_approved') {
      return { title: 'Article approved', body: payload?.title || 'Your article was approved', url: `/article/${payload?.article_id}` }
    }
    if (type === 'article_rejected') {
      return { title: 'Article rejected', body: payload?.reason ? `Reason: ${payload.reason}` : 'Please revise your article', url: `/dashboard` }
    }
    if (type === 'pending_article_submitted') {
      const by = payload?.author_name ? `${payload.author_name} submitted` : 'New submission'
      const t = payload?.title ? `: ${payload.title}` : ''
      return { title: 'Approval needed', body: `${by}${t}`.slice(0, 120), url: `/admin` }
    }
    return null
  } catch {
    return null
  }
}

async function sendPushToUser(user_id, msg) {
  try {
    let webPush
    try { webPush = (await import('web-push')).default } catch (e) { return }
    const pub = process.env.VAPID_PUBLIC_KEY
    const priv = process.env.VAPID_PRIVATE_KEY
    const sub = process.env.VAPID_SUBJECT || 'mailto:support@example.com'
    if (!pub || !priv) return
    webPush.setVapidDetails(sub, pub, priv)
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', user_id)
    if (error) return
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url })
    for (const s of subs || []) {
      try {
        await webPush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      } catch (e) {
        // ignore per-subscription errors
      }
    }
  } catch (e) {
    // swallow errors
  }
}

async function sendPushToUsers(user_ids, msg) {
  if (!Array.isArray(user_ids) || user_ids.length === 0 || !msg) return
  for (const uid of user_ids) await sendPushToUser(uid, msg)
}
