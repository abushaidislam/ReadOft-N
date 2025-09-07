import { createClient } from '@supabase/supabase-js'
// Ensure .env is loaded even if server is started outside the `server` dir
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

try {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  // .env located at server/.env (one level up from src)
  dotenv.config({ path: path.resolve(__dirname, '../.env') })
} catch {}

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey

if (!url) {
  console.warn('[Supabase] SUPABASE_URL is not set. API calls will fail until configured.')
}

export const supabase = createClient(url || 'http://localhost', serviceKey || 'public-anon-key')
