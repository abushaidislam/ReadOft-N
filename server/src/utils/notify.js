import { randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'

export async function notify(user_id, type, payload = {}) {
  try {
    if (!user_id) return
    const row = { id: randomUUID(), user_id, type, payload, is_read: false, created_at: new Date() }
    const { error } = await supabase.from('notifications').insert(row)
    if (error) console.error('notify insert error', error)
  } catch (e) {
    console.error('notify error', e)
  }
}

