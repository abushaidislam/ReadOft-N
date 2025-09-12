import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes from './routes/auth.js'
import articleRoutes from './routes/articles.js'
import followRoutes from './routes/follows.js'
import likeRoutes from './routes/likes.js'
import adminRoutes from './routes/admin.js'
import categoryRoutes from './routes/categories.js'
import feedRoutes from './routes/feed.js'
import uploadRoutes from './routes/uploads.js'
import commentRoutes from './routes/comments.js'
import meRoutes from './routes/me.js'
import readRoutes from './routes/reads.js'
import notificationsRoutes from './routes/notifications.js'
import authorsRoutes from './routes/authors.js'
import { authOptional } from './middleware/auth.js'
import bookmarksRoutes from './routes/bookmarks.js'
import searchRoutes from './routes/search.js'
import seoRoutes from './routes/seo.js'
import reportsRoutes from './routes/reports.js'
import aiRoutes from './routes/ai.js'
import { startPublishScheduler } from './utils/scheduler.js'
import newsletterRoutes from './routes/newsletter.js'
import contactRoutes from './routes/contact.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ 
  origin: [
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:3000',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
  ], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}))
app.use(express.json({ limit: '1mb' }))
app.use(authOptional)

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'readoft-api' }))

// Configuration guard: if Supabase is not configured, return a clear 503 for API calls
const missingSupabase = !process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)
if (missingSupabase) {
  // eslint-disable-next-line no-console
  console.warn('[Startup] SUPABASE_URL or API keys missing. API endpoints will return 503 until configured.')
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next()
    return res.status(503).json({ message: 'Server not configured. Please set SUPABASE_URL and at least one of SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in server/.env.' })
  })
}
app.use('/api/auth', authRoutes)
app.use('/api/articles', articleRoutes)
app.use('/api/follows', followRoutes)
app.use('/api/likes', likeRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/me', meRoutes)
app.use('/api/reads', readRoutes)
app.use('/api/authors', authorsRoutes)
app.use('/api', commentRoutes)
app.use('/api', bookmarksRoutes)
app.use('/api', notificationsRoutes)
app.use('/api', searchRoutes)
app.use('/api', reportsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/contact', contactRoutes)
app.use('/', seoRoutes)

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Server error' })
})

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
// Start background scheduler for scheduled publishing
startPublishScheduler()
