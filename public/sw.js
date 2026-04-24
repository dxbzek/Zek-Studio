// Zek Studio — minimal offline service worker.
//
// Strategy:
//   • Static build assets under /assets/ (hashed filenames) → cache-first.
//     Safe because Vite hash-invalidates on every build, so a new deploy
//     lands under a new filename the cache won't match yet.
//   • Everything else (Supabase API, auth, realtime, uploads) → network-only,
//     never cached. We never want a stale brand/task to serve from cache and
//     mislead the user.
//   • Navigation requests (the HTML shell) → network-first with a cached
//     offline fallback so the PWA boots without connectivity and the JS
//     bundles take over from there.
//
// Bump CACHE_VERSION to bust all precached assets on a breaking deploy.

const CACHE_VERSION = 'v1'
const CACHE_NAME = `zek-studio-${CACHE_VERSION}`
const OFFLINE_URL = '/'
// Precache the shell on install. Vite's hashed bundles inside /assets/ will
// fill the cache on first visit via the fetch handler — no need to list them
// here (we don't know the hashes at build time).
const PRECACHE = [
  '/',
  '/favicon.svg',
  '/logo.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  // Drop any previous cache versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Only intercept same-origin requests. Cross-origin (Supabase, Google
  // fonts, etc.) goes straight through.
  if (url.origin !== self.location.origin) return

  // Navigations: network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response('', { status: 503 }))
      )
    )
    return
  }

  // Static hashed assets: cache-first with lazy fill.
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit
        return fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, copy))
          return res
        })
      })
    )
  }
})
