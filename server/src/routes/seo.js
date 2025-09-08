import express from 'express'
import { supabase } from '../supabase.js'

const router = express.Router()

function getBaseUrl(req) {
  const env = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || ''
  if (env) return env.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173'
  return `${proto}://${host}`
}

// Sitemap
router.get(['/sitemap.xml','/api/sitemap.xml'], async (req, res) => {
  try {
    const base = getBaseUrl(req)
    const urls = []
    urls.push(`${base}/`)
    urls.push(`${base}/categories`)
    urls.push(`${base}/feed`)
    // categories
    const { data: cats } = await supabase.from('categories').select('slug')
    for (const c of (cats || [])) urls.push(`${base}/category/${encodeURIComponent(c.slug)}`)
    // articles (latest 2000)
    const { data: arts } = await supabase
      .from('articles')
      .select('id, slug, updated_at, created_at, status, publish_at')
      .eq('status','published')
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order('updated_at', { ascending: false })
      .limit(2000)
    const xmlItems = urls.map(u => `<url><loc>${u}</loc></url>`)
    for (const a of (arts || [])) {
      const link = a.slug ? `${base}/a/${a.slug}` : `${base}/article/${a.id}`
      const lastmod = (a.updated_at || a.created_at || new Date()).toString()
      xmlItems.push(`<url><loc>${link}</loc><lastmod>${new Date(lastmod).toISOString()}</lastmod></url>`)  
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlItems.join('\n')}\n</urlset>`
    res.set('Content-Type','application/xml').send(xml)
  } catch (e) {
    res.status(500).send('')
  }
})

// RSS feed
router.get(['/rss.xml','/api/rss.xml'], async (req, res) => {
  try {
    const base = getBaseUrl(req)
    const siteTitle = process.env.APP_NAME || 'Readoft'
    const { data: items } = await supabase
      .from('articles')
      .select('id, slug, title, content, created_at, updated_at, publish_at, status, author:users!articles_author_id_fkey(name)')
      .eq('status','published')
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(50)
    const now = new Date().toUTCString()
    const rssItems = (items || []).map((a) => {
      const link = a.slug ? `${base}/a/${a.slug}` : `${base}/article/${a.id}`
      const desc = (a.content || '').replace(/<[^>]+>/g,'').slice(0,240)
      const pub = new Date(a.created_at || a.updated_at || Date.now()).toUTCString()
      const author = a.author?.name ? `<author>${a.author.name}</author>` : ''
      return `<item><title><![CDATA[${a.title}]]></title><link>${link}</link><guid>${link}</guid>${author}<pubDate>${pub}</pubDate><description><![CDATA[${desc}]]></description></item>`
    })
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title><![CDATA[${siteTitle}]]></title><link>${base}</link><description><![CDATA[Latest articles]]></description><lastBuildDate>${now}</lastBuildDate>${rssItems.join('')}\n</channel></rss>`
    res.set('Content-Type','application/rss+xml').send(xml)
  } catch (e) {
    res.status(500).send('')
  }
})

export default router
