const CACHE = 'sokomw-v10'
const IMAGES_CACHE = 'sokomw-images-v1'
const MAX_CACHED_IMAGES = 120
const ASSETS = ['/', '/index.html']

// ── Install & cache ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
  self.skipWaiting()
})

// ── Activate & clean old caches ──────────────────────────
self.addEventListener('activate', e => {
  const keep = [CACHE, IMAGES_CACHE]
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      // Re-cache a fresh app shell so a stale cached index.html can never
      // reference hashed bundles that no longer exist on the server
      // (stale shell → 404 bundles → blank white page on mobile).
      .then(async () => {
        try {
          const cache = await caches.open(CACHE)
          const shell = await fetch('/index.html', { cache: 'reload' })
          if (shell.ok) await cache.put('/index.html', shell)
        } catch { /* network unavailable — keep existing shell */ }
        return self.clients.claim()
      })
  )
})

function isDevBypass(url) {
  // Never intercept Vite / HMR / source modules — these break localhost:5173
  const path = url.pathname || ''
  if (
    path.startsWith('/@vite') ||
    path.startsWith('/@react-refresh') ||
    path.startsWith('/@fs') ||
    path.startsWith('/@id') ||
    path.startsWith('/src/') ||
    path.startsWith('/node_modules/') ||
    path.includes('__vite') ||
    url.searchParams.has('t') && (path.endsWith('.jsx') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.css'))
  ) {
    return true
  }
  // Local dev hosts — leave everything to the network (Vite)
  const host = url.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return true
  }
  return false
}

// R2/CDN image URLs carry uuid filenames and immutable Cache-Control,
// so serving already-downloaded images first saves data on mobile networks.
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGES_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone()).catch(() => {})
    // Bound the image cache (LRU by insertion order)
    const keys = await cache.keys()
    if (keys.length > MAX_CACHED_IMAGES) {
      await Promise.all(keys.slice(0, keys.length - MAX_CACHED_IMAGES).map(k => cache.delete(k)))
    }
  }
  return response
}

// ── Fetch (network first, cache fallback) ────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  let url
  try {
    url = new URL(e.request.url)
  } catch {
    return
  }

  // Cache-first for cross-origin CDN listing/shop images (saves data, works offline)
  if (url.origin !== self.location.origin) {
    if (e.request.destination === 'image' || /\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(url.pathname)) {
      e.respondWith(
        cacheFirstImage(e.request).catch(async () => {
          const cached = await caches.match(e.request)
          if (cached) return cached
          return Response.error()
        })
      )
      return
    }
    return
  }

  if (e.request.url.includes('supabase.co')) return

  // Critical: do not touch Vite dev / HMR traffic
  if (isDevBypass(url)) return

  // Never cache JS modules — always fetch fresh (production bundles)
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.map')
  ) {
    e.respondWith(fetch(e.request))
    return
  }

  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request)
      if (cached) return cached
      // App shell fallback for navigations — network-fresh shell first,
      // cached shell only when offline (never a stale shell while online).
      if (e.request.mode === 'navigate') {
        try {
          const fresh = await fetch('/index.html', { cache: 'reload' })
          if (fresh.ok) return fresh
        } catch { /* offline */ }
        const shell = await caches.match('/index.html')
        if (shell) return shell
      }
      return new Response('Network error and no cache available', {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'text/plain' },
      })
    })
  )
})

// ── Push notifications (incoming calls) ─────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {}

  const options = {
    body: `${data.callerName} is calling you`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'incoming-call',
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
    data: {
      callId: data.callId,
      fromUser: data.fromUser,
      callType: data.callType,
      chatId: data.chatId,
    },
    actions: [
      { action: 'answer',  title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' }
    ]
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(
        `📞 Incoming ${data.callType || 'Video'} Call from ${data.callerName}`,
        options
      ),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ type: 'INCOMING_CALL', ...data })
        })
      })
    ])
  )
})

// ── Notification click (answer / decline) ────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { callId, fromUser, chatId } = event.notification.data

  if (event.action === 'decline') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(c => c.postMessage({ type: 'DECLINE_CALL', callId, fromUser }))
      })
    )
    return
  }

  const url = chatId ? `/chat/${chatId}` : `/chat/${fromUser}`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'ANSWER_CALL', callId, fromUser, chatId })
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
