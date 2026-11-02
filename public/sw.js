const SHELL = 'shell-v1'
const DATA = 'data-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}))
    return response
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}))
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/smn/')) {
    event.respondWith(networkFirst(event, request, DATA))
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event, request, SHELL))
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event, request, SHELL))
  }
})
