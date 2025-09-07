import express from 'express'
import multer from 'multer'
import { supabase } from '../supabase.js'
import { authRequired } from '../middleware/auth.js'
import { requireRole, ROLES } from '../utils/roles.js'
import { randomUUID } from 'node:crypto'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

async function ensureBucketPublic(name) {
  // Try to get; if not found or error, attempt to create. Ignore "already exists".
  const { data, error } = await supabase.storage.getBucket(name)
  if (data && !error) {
    // Ensure bucket is public if it already exists
    if (data.public !== true) {
      try {
        await supabase.storage.updateBucket(name, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        })
      } catch (e) {
        // best-effort; continue
      }
    }
    return
  }
  const { error: createErr } = await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // ~5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (createErr && !/already exists|exists/i.test(createErr.message || '')) {
    throw createErr
  }
}

router.post('/article-thumbnail', authRequired, requireRole(ROLES.AUTHOR, ROLES.ADMIN), upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) return res.status(400).json({ message: 'Invalid file type' })

    const bucket = 'thumbnails'
    await ensureBucketPublic(bucket)

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
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

// Avatar upload for any logged-in user
router.post('/avatar', authRequired, upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) return res.status(400).json({ message: 'Invalid file type' })
    const bucket = 'avatars'
    await ensureBucketPublic(bucket)
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
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

export default router
