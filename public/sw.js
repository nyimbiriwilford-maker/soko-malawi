const CACHE_VERSION = 'sokomw-v12'
const CACHE = CACHE_VERSION
const IMAGES_CACHE = 'sokomw-images-v1'
const MAX_CACHED_IMAGES = 120

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting()
})

// ── Activate & clean old caches ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMAGES_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

function isDevBypass(url) {
  const path = url.pathname || ''
  if (
    path.startsWith('/@vite') ||
    path.startsWith('/@react-refresh') ||
    path.startsWith('/@fs') ||
    path.startsWith('/@id') ||
    path.startsWith('/src/') ||
    path.startsWith('/node_modules/') ||
    path.includes('__vite')
  ) return true
  const host = url.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true
  return false
}

async function cacheFirstImage(request) {
  try {
    const cache = await caches.open(IMAGES_CACHE)
    const hit = await cache.match(request)
    if (hit) return hit
    const response = await fetch(request)
    if ((response.ok || response.type === 'opaque') && response.status === 200) {
      const ct = response.headers.get('content-type') || ''
      if (!/text\/html/i.test(ct)) {
        cache.put(request, response.clone()).catch(() => {})
      }
      const keys = await cache.keys()
      if (keys.length > MAX_CACHED_IMAGES) {
        await Promise.all(keys.slice(0, keys.length - MAX_CACHED_IMAGES).map(k => cache.delete(k)))
      }
    }
    return response
  } catch {
    return fetch(request)
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  let url
  try { url = new URL(e.request.url) } catch { return }

  if (url.origin !== self.location.origin) {
    const host = url.hostname
    const allowedHost =
      host === self.location.hostname ||
      host.endsWith('.supabase.co') ||
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com')
    if (!allowedHost) return
    if (e.request.destination === 'image' || /\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(url.pathname)) {
      e.respondWith(
        cacheFirstImage(e.request).catch(async () => {
          const cached = await caches.match(e.request)
          if (cached) return cached
          return fetch(e.request).catch(() => Response.error())
        })
      )
      return
    }
    return
  }

  if (e.request.url.includes('supabase.co')) return
  if (isDevBypass(url)) return

  // Never cache JS/CSS modules — always network
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.map')
  ) {
    e.respondWith(fetch(e.request))
    return
  }

  // Navigations: network-first, cache only offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && res.status === 200) {
          const ct = res.headers.get('content-type') || ''
          if (!/text\/html/i.test(ct)) return res
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        }
        return res
      }).catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        const shell = await caches.match('/index.html')
        if (shell) return shell
        return new Response('Network error and no cache available', {
          status: 504, statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'text/plain' },
        })
      })
    )
    return
  }

  // Other same-origin: network-first, no html caching for js/css already handled
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.status === 200) {
        const ct = res.headers.get('content-type') || ''
        if (!/text\/html/i.test(ct) || !/\.(js|css)$/i.test(url.pathname)) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        }
      }
      return res
    }).catch(async () => {
      const cached = await caches.match(e.request)
      if (cached) return cached
      return new Response('Network error and no cache available', {
        status: 504, statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'text/plain' },
      })
    })
  )
})

// ── Push notifications ────────────────────────────────────
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
    data: { callId: data.callId, fromUser: data.fromUser, callType: data.callType, chatId: data.chatId },
    actions: [{ action: 'answer', title: '✅ Answer' }, { action: 'decline', title: '❌ Decline' }]
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(`📞 Incoming ${data.callType || 'Video'} Call from ${data.callerName}`, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(client => client.postMessage({ type: 'INCOMING_CALL', ...data }))
      })
    ])
  )
})

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