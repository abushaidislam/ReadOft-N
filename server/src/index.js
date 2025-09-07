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
import meRoutes from './routes/me.js'
import readRoutes from './routes/reads.js'
import authorsRoutes from './routes/authors.js'
import { authOptional } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true, credentials: false }))
app.use(express.json({ limit: '1mb' }))
app.use(authOptional)

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'readoft-api' }))
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

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Server error' })
})

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
