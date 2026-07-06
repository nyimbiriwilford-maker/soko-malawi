const CACHE = 'sokomw-v5'
const ASSETS = ['/', '/index.html']

// ── Install & cache ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
  self.skipWaiting()
})

// ── Activate & clean old caches ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

// ── Fetch (network first, cache fallback) ────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('supabase.co')) return
  // Never cache JS/JSX files — always fetch fresh
  if (e.request.url.includes('.js') || e.request.url.includes('.jsx')) {
    e.respondWith(fetch(e.request))
    return
  }
  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request)
      if (cached) return cached
      // No live response and no cache match — fall back to the cached
      // app shell so navigations never resolve to undefined (which
      // throws "Failed to convert value to 'Response'" and breaks the
      // page load). Only meaningful for navigation requests; other
      // assets with no cache entry will still correctly fail.
      if (e.request.mode === 'navigate') {
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
      // Forward to app if open so it can play ringtone
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
      // App is closed — open it, call will be handled via restorePendingCall
      return self.clients.openWindow(url)
    })
  )
})