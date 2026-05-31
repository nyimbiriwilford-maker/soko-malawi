self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Listen for push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const { callerName, callerAvatar, callType, callId, fromUser } = data

  e.waitUntil(
    self.registration.showNotification('Incoming Call', {
      body: `${callerName} is calling you${callType === 'video' ? ' (video)' : ''}`,
      icon: callerAvatar || '/favicon.svg',
      image: callerAvatar || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'incoming-call-' + callId,
      renotify: true,
      requireInteraction: true, // keeps notification until user acts
      vibrate: [500, 200, 500, 200, 500],
      actions: [
        { action: 'decline', title: '❌ Decline' },
        { action: 'answer',  title: '✅ Answer'  },
      ],
      data: { callId, fromUser, callType, callerName, url: `/chat/${fromUser}` }
    })
  )
})

// Handle notification button clicks
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const { action } = e
  const { url, callId, fromUser } = e.notification.data

  if (action === 'decline') {
    // Post to app if open, otherwise store decline for next open
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({ type: 'DECLINE_CALL', callId, fromUser })
        } else {
          // Store in IndexedDB for app to pick up on next open
          self.registration.showNotification('Call declined', {
            body: 'You declined the call',
            tag: 'call-declined',
            requireInteraction: false,
          })
        }
      })
    )
    return
  }

  // Answer or tap — open the chat
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const target = clients.find(c => c.url.includes(fromUser))
      if (target) {
        target.focus()
        target.postMessage({ type: 'ANSWER_CALL', callId, fromUser })
      } else {
        self.clients.openWindow(url).then(win => {
          if (win) {
            setTimeout(() => {
              win.postMessage({ type: 'ANSWER_CALL', callId, fromUser })
            }, 2000)
          }
        })
      }
    })
  )
})