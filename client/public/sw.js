/* Readoft Service Worker */
const CACHE_NAME = 'readoft-cache-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/logo.png',
  '/manifest.webmanifest'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      try { await cache.addAll(PRECACHE) } catch (err) { console.debug('sw precache failed', err) }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle same-origin
  if (url.origin !== location.origin) return

  // For navigation requests: network-first, fallback to offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req)
          // Optionally cache successful navigations
          const cache = await caches.open(CACHE_NAME)
          cache.put(req, resp.clone()).catch((err) => console.debug('sw cache put nav failed', err))
          return resp
        } catch (e) {
          console.debug('sw nav fetch failed', e)
          const cache = await caches.open(CACHE_NAME)
          const cached = await cache.match(req)
          return cached || cache.match(OFFLINE_URL)
        }
      })()
    )
    return
  }

  // Cache-first for static assets
  const dest = req.destination
  const isStatic = dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font' || url.pathname.startsWith('/assets/')
  if (req.method === 'GET' && isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(req)
        if (cached) return cached
        try {
          const resp = await fetch(req)
          cache.put(req, resp.clone()).catch((err) => console.debug('sw cache put asset failed', err))
          return resp
        } catch (e) {
          console.debug('sw asset fetch failed', e)
          return cached || fetch(req)
        }
      })()
    )
    return
  }

  // For others, default network
})
