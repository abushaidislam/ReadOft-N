import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
console.log('URL:', url ? url : '(missing)')
console.log('Key present:', !!key)

const sb = createClient(url, key)
try {
  const { data, error, status } = await sb.from('articles').select('*').limit(3)
  console.log('Status:', status)
  console.log('Error:', error)
  console.log('Data sample count:', data?.length ?? 0)
} catch (e) {
  console.error('Caught error:', e)
}

