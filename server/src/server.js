import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';

// Import all your routes
import authRoutes from './routes/auth.js';
import articleRoutes from './routes/articles.js';
import followRoutes from './routes/follows.js';
import likeRoutes from './routes/likes.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/categories.js';
import feedRoutes from './routes/feed.js';
import uploadRoutes from './routes/uploads.js';
import commentRoutes from './routes/comments.js';
import meRoutes from './routes/me.js';
import readRoutes from './routes/reads.js';
import notificationsRoutes from './routes/notifications.js';
import authorsRoutes from './routes/authors.js';
import { authOptional } from './middleware/auth.js';
import bookmarksRoutes from './routes/bookmarks.js';
import searchRoutes from './routes/search.js';
import seoRoutes from './routes/seo.js';
import reportsRoutes from './routes/reports.js';
import { startPublishScheduler } from './utils/scheduler.js';

const app = express();

// Middleware
app.use(cors({ 
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true, 
  credentials: false 
}));
app.use(express.json({ limit: '1mb' }));
app.use(authOptional);

// Routes
app.get('/.netlify/functions/api/health', (_req, res) => res.json({ ok: true, service: 'readoft-api' }));
app.use('/.netlify/functions/api/auth', authRoutes);
app.use('/.netlify/functions/api/articles', articleRoutes);
app.use('/.netlify/functions/api/follows', followRoutes);
app.use('/.netlify/functions/api/likes', likeRoutes);
app.use('/.netlify/functions/api/admin', adminRoutes);
app.use('/.netlify/functions/api/categories', categoryRoutes);
app.use('/.netlify/functions/api/feed', feedRoutes);
app.use('/.netlify/functions/api/uploads', uploadRoutes);
app.use('/.netlify/functions/api/me', meRoutes);
app.use('/.netlify/functions/api/reads', readRoutes);
app.use('/.netlify/functions/api/authors', authorsRoutes);
app.use('/.netlify/functions/api', commentRoutes);
app.use('/.netlify/functions/api', bookmarksRoutes);
app.use('/.netlify/functions/api', notificationsRoutes);
app.use('/.netlify/functions/api', searchRoutes);
app.use('/.netlify/functions/api', reportsRoutes);
app.use('/.netlify/functions', seoRoutes);

// Error handling
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error' });
});

// Start scheduler (Note: This might not work as expected in serverless)
if (process.env.NETLIFY_DEV !== 'true') {
  startPublishScheduler();
}

// For local development
if (process.env.NETLIFY_DEV === 'true') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}

export const handler = serverless(app);
export default app;
