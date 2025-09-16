import express from 'express'
import multer from 'multer'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { randomUUID } from 'node:crypto'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// List existing videos (if bucket is present)
router.get('/videos', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const bucket = 'videos'
    await ensureBucketPublic(bucket)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '60', 10)))
    const prefix = String(req.user.id || '').trim()
    const { data: files, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    })
    if (error) throw error
    const items = (files || [])
      .filter(f => f && f.name && !f.name.endsWith('/'))
      .map((f) => {
        const path = `${prefix}/${f.name}`
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        return { name: f.name, path, url: pub.publicUrl, updated_at: f.updated_at || null, created_at: f.created_at || null, size: f.metadata?.size || null }
      })
    res.json({ items })
  } catch (e) {
    console.error('List videos error:', e)
    res.status(500).json({ message: e?.message || 'Failed to list videos' })
  }
})

// Delete a file from a bucket
router.post('/delete', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const { bucket, path } = req.body || {}
    const allowed = ['article-media', 'thumbnails', 'videos']
    if (!allowed.includes(bucket)) return res.status(400).json({ message: 'Invalid bucket' })
    if (!path || typeof path !== 'string') return res.status(400).json({ message: 'Missing path' })
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw error
    res.json({ success: true })
  } catch (e) {
    console.error('Delete file error:', e)
    res.status(500).json({ message: e?.message || 'Delete failed' })
  }
})

// Rename (move) a file within the same bucket and folder
router.post('/rename', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const { bucket, path, newName } = req.body || {}
    const allowed = ['article-media', 'thumbnails', 'videos']
    if (!allowed.includes(bucket)) return res.status(400).json({ message: 'Invalid bucket' })
    if (!path || typeof path !== 'string' || !newName) return res.status(400).json({ message: 'Missing path/newName' })
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const to = dir ? `${dir}/${newName}` : newName
    const { error } = await supabase.storage.from(bucket).move(path, to)
    if (error) throw error
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(to)
    res.json({ success: true, path: to, url: pub.publicUrl })
  } catch (e) {
    console.error('Rename file error:', e)
    res.status(500).json({ message: e?.message || 'Rename failed' })
  }
})
async function ensureBucketPublic(name) {
  // Allowed MIME types per bucket
  const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  const videoMimes = ['video/mp4', 'video/webm']
  const paramsByBucket = () => {
    if (name === 'videos') return { allowedMimeTypes: videoMimes, fileSizeLimit: 50 * 1024 * 1024 }
    if (['article-media', 'thumbnails', 'avatars'].includes(name)) return { allowedMimeTypes: imageMimes, fileSizeLimit: 5 * 1024 * 1024 }
    return { fileSizeLimit: 5 * 1024 * 1024 }
  }

  // Try to get; if not found or error, attempt to create (idempotent).
  const { data, error } = await supabase.storage.getBucket(name)
  if (data && !error) {
    try {
      await supabase.storage.updateBucket(name, {
        public: true,
        ...paramsByBucket(),
      })
    } catch (e) {
      // best-effort; continue even if update fails (e.g., insufficient perms)
    }
    return
  }
  const { error: createErr } = await supabase.storage.createBucket(name, {
    public: true,
    ...paramsByBucket(),
  })
  if (createErr && !/already exists|exists/i.test(createErr.message || '')) {
    throw createErr
  }
}

router.post('/article-thumbnail', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.mimetype)) return res.status(400).json({ message: 'Invalid file type' })

    const bucket = 'thumbnails'
    await ensureBucketPublic(bucket)

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : (file.mimetype === 'image/svg+xml' ? 'svg' : 'jpg')
    const path = `${req.user.id}/${randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false,
    })
    if (upErr) throw upErr

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
    res.status(201).json({ url: pub.publicUrl, path })
  } catch (e) {
    console.error('Upload thumbnail error:', e)
    const msg = e?.message || (typeof e === 'string' ? e : 'Upload failed')
    res.status(500).json({ message: msg })
  }
})

// List existing article media for the current user
router.get('/article-media', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const bucket = 'article-media'
    await ensureBucketPublic(bucket)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '60', 10)))
    const prefix = String(req.user.id || '').trim()
    const { data: files, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    })
    if (error) throw error
    const items = (files || [])
      .filter(f => f && f.name && !f.name.endsWith('/'))
      .map((f) => {
        const path = `${prefix}/${f.name}`
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        return { name: f.name, path, url: pub.publicUrl, updated_at: f.updated_at || null, created_at: f.created_at || null, size: f.metadata?.size || null }
      })
    res.json({ items })
  } catch (e) {
    console.error('List media error:', e)
    res.status(500).json({ message: e?.message || 'Failed to list media' })
  }
})

// List existing thumbnails for the current user (optional)
router.get('/thumbnails', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), async (req, res) => {
  try {
    const bucket = 'thumbnails'
    await ensureBucketPublic(bucket)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '60', 10)))
    const prefix = String(req.user.id || '').trim()
    const { data: files, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    })
    if (error) throw error
    const items = (files || [])
      .filter(f => f && f.name && !f.name.endsWith('/'))
      .map((f) => {
        const path = `${prefix}/${f.name}`
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        return { name: f.name, path, url: pub.publicUrl, updated_at: f.updated_at || null, created_at: f.created_at || null, size: f.metadata?.size || null }
      })
    res.json({ items })
  } catch (e) {
    console.error('List thumbnails error:', e)
    res.status(500).json({ message: e?.message || 'Failed to list thumbnails' })
  }
})

// Avatar upload for any logged-in user
router.post('/avatar', authRequired, upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) return res.status(400).json({ message: 'Invalid file type' })
    const bucket = 'avatars'
    await ensureBucketPublic(bucket)
    const ext = file.mimetype === 'image/png'
      ? 'png'
      : file.mimetype === 'image/webp'
        ? 'webp'
        : (file.mimetype === 'image/svg+xml' ? 'svg' : 'jpg')
    const path = `${req.user.id}/${randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '3600', upsert: false })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
    res.status(201).json({ url: pub.publicUrl, path })
  } catch (e) {
    console.error('Upload avatar error:', e)
    res.status(500).json({ message: e?.message || 'Upload failed' })
  }
})

// Generic article media (inline images)
router.post('/article-media', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), upload.single('file'), async (req, res) => {
  try {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    const bucket = 'article-media'
    await ensureBucketPublic(bucket)

    const file = req.file
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''

    // Case 1: multipart file upload
    if (file) {
      if (!allowed.includes(file.mimetype)) return res.status(400).json({ message: 'Invalid file type' })
      const ext = file.mimetype === 'image/png' ? 'png' : (file.mimetype === 'image/webp' ? 'webp' : (file.mimetype === 'image/svg+xml' ? 'svg' : 'jpg'))
      const path = `${req.user.id}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path)
      return res.status(201).json({ url: pub.publicUrl, path })
    }

    // Case 2: JSON body with a public URL to fetch
    if (url) {
      let resp
      try { resp = await fetch(url) } catch { return res.status(400).json({ message: 'Failed to fetch URL' }) }
      if (!resp?.ok) return res.status(400).json({ message: 'Failed to fetch URL' })
      const ctype = (resp.headers.get('content-type') || '').split(';')[0].trim()
      if (!allowed.includes(ctype)) return res.status(400).json({ message: 'Invalid content type' })
      const ab = await resp.arrayBuffer()
      const buf = Buffer.from(ab)
      const ext = ctype === 'image/png' ? 'png' : (ctype === 'image/webp' ? 'webp' : (ctype === 'image/svg+xml' ? 'svg' : 'jpg'))
      const path = `${req.user.id}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, { contentType: ctype, cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path)
      return res.status(201).json({ url: pub.publicUrl, path })
    }

    return res.status(400).json({ message: 'No file uploaded' })
  } catch (e) {
    console.error('Upload media error:', e)
    res.status(500).json({ message: e?.message || 'Upload failed' })
  }
})

export default router
