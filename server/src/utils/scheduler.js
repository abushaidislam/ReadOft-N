import { supabase } from '../supabase.js'
import { notifyFollowersOfArticle } from './notify.js'

let running = false

export function startPublishScheduler(intervalMs = 60000) {
  async function tick() {
    if (running) return
    running = true
    try {
      const nowIso = new Date().toISOString()
      // Find published articles that should now go live (no published_at yet)
      const { data: rows, error } = await supabase
        .from('articles')
        .select('id, author_id, title, publish_at, published_at, status')
        .eq('status', 'published')
        .is('published_at', null)
        .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
        .limit(50)
      if (error) throw error
      for (const a of rows || []) {
        try {
          const now = new Date()
          const { data: updated, error: uErr } = await supabase
            .from('articles')
            .update({ published_at: now, updated_at: now })
            .eq('id', a.id)
            .select('id, author_id, title')
            .single()
          if (!uErr && updated) {
            try { await notifyFollowersOfArticle(updated.author_id, updated.id, updated.title) } catch (e) { console.error('scheduler notify error', e) }
          }
        } catch (e) {
          console.error('publish scheduler item error', e)
        }
      }
    } catch (e) {
      console.error('publish scheduler error', e)
    } finally {
      running = false
    }
  }
  // initial delay small to allow boot
  setTimeout(tick, 5000)
  return setInterval(tick, intervalMs)
}

